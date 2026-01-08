package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ============================================
// AUTH HANDLER
// ============================================

// User represents an authenticated user
type User struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Nickname string `json:"nickname"`
	Role     string `json:"role"` // "super_admin", "admin", or "client"
	Picture  string `json:"picture"`
}

// Session represents an active session
type Session struct {
	Token     string
	User      User
	ExpiresAt time.Time
}

// AdminUser represents hardcoded admin configuration
type AdminUser struct {
	PasswordHash string
	Name         string
	Nickname     string
}

// AuthHandler handles authentication
type AuthHandler struct {
	adminUsers     map[string]AdminUser // email -> admin config
	sessions       map[string]*Session  // token -> session
	sessionsMu     sync.RWMutex
	allowedDomains []string
	allowedOrigins map[string]bool
	allowAll       bool
}

func NewAuthHandler(origins []string) *AuthHandler {
	h := &AuthHandler{
		adminUsers:     make(map[string]AdminUser),
		sessions:       make(map[string]*Session),
		allowedDomains: []string{"starcrown.partners"},
		allowedOrigins: make(map[string]bool),
	}

	for _, o := range origins {
		if o == "*" {
			h.allowAll = true
			break
		}
		h.allowedOrigins[o] = true
	}

	// Load admin users from environment
	h.loadAdminUsers()

	// Start session cleanup goroutine
	go h.cleanupExpiredSessions()

	return h
}

// loadAdminUsers loads admin credentials from environment variables
// Format: ADMIN_USERS=email1:hash:name:nickname,email2:hash:name:nickname
func (h *AuthHandler) loadAdminUsers() {
	// Default admin (password hash for "Pulse4me!" using SHA256)
	// In production, use bcrypt instead
	defaultHash := hashPassword("Pulse4me!")

	// Check for environment override
	adminConfig := os.Getenv("ADMIN_USERS")
	if adminConfig == "" {
		// Default admin
		h.adminUsers["michael@starcrown.partners"] = AdminUser{
			PasswordHash: defaultHash,
			Name:         "Michael",
			Nickname:     "McBile",
		}
		slog.Info("loaded default admin user", "email", "michael@starcrown.partners")
		return
	}

	// Parse ADMIN_USERS env var
	users := strings.Split(adminConfig, ",")
	for _, u := range users {
		parts := strings.Split(u, ":")
		if len(parts) != 4 {
			slog.Warn("invalid admin user format", "value", u)
			continue
		}
		email := strings.ToLower(strings.TrimSpace(parts[0]))
		h.adminUsers[email] = AdminUser{
			PasswordHash: parts[1],
			Name:         parts[2],
			Nickname:     parts[3],
		}
		slog.Info("loaded admin user", "email", email)
	}
}

func hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

func (h *AuthHandler) verifyPassword(stored, provided string) bool {
	providedHash := hashPassword(provided)
	return subtle.ConstantTimeCompare([]byte(stored), []byte(providedHash)) == 1
}

func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (h *AuthHandler) createSession(user User) string {
	token := generateToken()
	session := &Session{
		Token:     token,
		User:      user,
		ExpiresAt: time.Now().Add(24 * time.Hour), // 24h session
	}

	h.sessionsMu.Lock()
	h.sessions[token] = session
	h.sessionsMu.Unlock()

	return token
}

func (h *AuthHandler) getSession(token string) (*Session, bool) {
	h.sessionsMu.RLock()
	session, ok := h.sessions[token]
	h.sessionsMu.RUnlock()

	if !ok {
		return nil, false
	}

	if time.Now().After(session.ExpiresAt) {
		h.deleteSession(token)
		return nil, false
	}

	return session, true
}

func (h *AuthHandler) deleteSession(token string) {
	h.sessionsMu.Lock()
	delete(h.sessions, token)
	h.sessionsMu.Unlock()
}

func (h *AuthHandler) cleanupExpiredSessions() {
	ticker := time.NewTicker(15 * time.Minute)
	for range ticker.C {
		h.sessionsMu.Lock()
		now := time.Now()
		for token, session := range h.sessions {
			if now.After(session.ExpiresAt) {
				delete(h.sessions, token)
			}
		}
		h.sessionsMu.Unlock()
	}
}

func (h *AuthHandler) isAllowedDomain(email string) bool {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return false
	}
	domain := strings.ToLower(parts[1])
	for _, allowed := range h.allowedDomains {
		if domain == allowed {
			return true
		}
	}
	return false
}

func (h *AuthHandler) setCORS(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if h.allowAll {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	} else if h.allowedOrigins[origin] {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
	w.Header().Set("Access-Control-Allow-Credentials", "true")
}

// HandleLogin handles POST /api/auth/login
func (h *AuthHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	h.setCORS(w, r)
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		Login    string `json:"login"`    // email or nickname
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}

	login := strings.ToLower(strings.TrimSpace(req.Login))
	password := req.Password

	// Check admin users (by email or nickname)
	for email, admin := range h.adminUsers {
		if email == login || strings.ToLower(admin.Nickname) == login {
			if h.verifyPassword(admin.PasswordHash, password) {
				user := User{
					Email:    email,
					Name:     admin.Name,
					Nickname: admin.Nickname,
					Role:     "super_admin",
					Picture:  "",
				}
				token := h.createSession(user)

				slog.Info("admin login successful", "email", email)

				json.NewEncoder(w).Encode(map[string]interface{}{
					"success": true,
					"token":   token,
					"user":    user,
				})
				return
			}
		}
	}

	// TODO: Check registered users from database
	// For now, only admin users are supported via backend auth

	slog.Warn("login failed", "login", login)
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]string{"error": "invalid credentials"})
}

// HandleLogout handles POST /api/auth/logout
func (h *AuthHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	h.setCORS(w, r)
	w.Header().Set("Content-Type", "application/json")

	token := extractToken(r)
	if token != "" {
		h.deleteSession(token)
	}

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// HandleVerify handles GET /api/auth/verify - check if session is valid
func (h *AuthHandler) HandleVerify(w http.ResponseWriter, r *http.Request) {
	h.setCORS(w, r)
	w.Header().Set("Content-Type", "application/json")

	token := extractToken(r)
	if token == "" {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "no token"})
		return
	}

	session, ok := h.getSession(token)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid or expired token"})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid": true,
		"user":  session.User,
	})
}

// HandleCORS handles OPTIONS requests
func (h *AuthHandler) HandleCORS(w http.ResponseWriter, r *http.Request) {
	h.setCORS(w, r)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Max-Age", "86400")
	w.WriteHeader(http.StatusNoContent)
}

// extractToken extracts bearer token from Authorization header
func extractToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}

// Middleware to protect routes
func (h *AuthHandler) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h.setCORS(w, r)

		token := extractToken(r)
		if token == "" {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "authentication required"})
			return
		}

		session, ok := h.getSession(token)
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid or expired token"})
			return
		}

		// Add user to context (simplified - in production use context.WithValue)
		r.Header.Set("X-User-Email", session.User.Email)
		r.Header.Set("X-User-Role", session.User.Role)

		next(w, r)
	}
}

// RequireAdmin middleware - requires admin role
func (h *AuthHandler) RequireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return h.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		role := r.Header.Get("X-User-Role")
		if role != "admin" {
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]string{"error": "admin access required"})
			return
		}
		next(w, r)
	})
}

// HandleGoogleLogin handles POST /api/auth/google - authenticate via Google OAuth
func (h *AuthHandler) HandleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	h.setCORS(w, r)
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		Credential string `json:"credential"` // Google ID token (JWT)
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}

	if req.Credential == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "credential required"})
		return
	}

	// Decode Google JWT (simplified - in production verify signature with Google's public keys)
	claims, err := decodeGoogleJWT(req.Credential)
	if err != nil {
		slog.Warn("failed to decode Google JWT", "error", err)
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid Google token"})
		return
	}

	email := strings.ToLower(claims.Email)

	// Check allowed domain
	if !h.isAllowedDomain(email) {
		slog.Warn("Google login denied - domain not allowed", "email", email)
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "Access denied. Only @starcrown.partners emails are allowed."})
		return
	}

	// Determine role and nickname
	role := "client"
	nickname := claims.Name

	// Check if user is in adminUsers (super_admin)
	if admin, ok := h.adminUsers[email]; ok {
		role = "super_admin"
		nickname = admin.Nickname
	}

	user := User{
		Email:    email,
		Name:     claims.Name,
		Nickname: nickname,
		Role:     role,
		Picture:  claims.Picture,
	}

	token := h.createSession(user)

	slog.Info("Google login successful", "email", email, "role", role)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   token,
		"user":    user,
	})
}

// GoogleClaims represents claims from Google ID token
type GoogleClaims struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// decodeGoogleJWT decodes a Google ID token without signature verification
// In production, you should verify the signature using Google's public keys
func decodeGoogleJWT(token string) (*GoogleClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT format")
	}

	// Decode payload (second part)
	payload := parts[1]
	// Add padding if needed
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}

	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		// Try standard encoding
		decoded, err = base64.StdEncoding.DecodeString(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to decode payload: %w", err)
		}
	}

	var claims GoogleClaims
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse claims: %w", err)
	}

	return &claims, nil
}
