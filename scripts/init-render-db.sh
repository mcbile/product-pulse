#!/bin/bash
# Скрипт инициализации TimescaleDB на Render
# Использование: ./scripts/init-render-db.sh <DATABASE_URL>

set -e

DATABASE_URL=${1:-$DATABASE_URL}

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not provided"
    echo "Usage: ./scripts/init-render-db.sh <DATABASE_URL>"
    echo "   or: DATABASE_URL=... ./scripts/init-render-db.sh"
    exit 1
fi

echo "=== Kaasino Pulse DB Initialization ==="
echo ""

# 1. Enable TimescaleDB extension
echo "[1/3] Enabling TimescaleDB extension..."
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"

# 2. Apply schema
echo "[2/3] Applying schema..."
psql "$DATABASE_URL" -f kaasino_pulse_schema.sql

# 3. Verify
echo "[3/3] Verifying installation..."
psql "$DATABASE_URL" -c "
SELECT
    hypertable_name,
    compression_enabled,
    num_chunks
FROM timescaledb_information.hypertables
ORDER BY hypertable_name;
"

echo ""
echo "=== Done! ==="
echo "Hypertables created successfully."
echo ""
echo "Next steps:"
echo "1. Deploy collector: render deploy"
echo "2. Test health: curl https://pulse-collector.onrender.com/health"
