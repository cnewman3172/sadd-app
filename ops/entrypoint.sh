#!/bin/sh
set -eu

# Wait for Postgres to be ready (up to ~2 minutes)
echo "Waiting for database..."
for i in $(seq 1 60); do
  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h db -p 5432 -U sadd >/dev/null 2>&1; then
      echo "Database is ready"; break
    fi
  else
    # fallback by attempting TCP connect
    (echo > /dev/tcp/db/5432) >/dev/null 2>&1 && { echo "Database is ready"; break; } || true
  fi
  echo "...waiting ($i)"; sleep 2
done

# Run migrations with baseline handling
echo "Running Prisma migrations..."
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null | wc -l)" -gt 0 ]; then
  if ! npx prisma migrate deploy; then
    echo "migrate deploy failed; attempting baseline resolve for first migration"
    FIRST_MIG=$(ls -1 prisma/migrations | head -n1)
    if [ -n "$FIRST_MIG" ]; then
      npx prisma migrate resolve --applied "$FIRST_MIG" || true
      npx prisma migrate deploy || true
    fi
  fi
else
  echo "No migrations directory; using db push"
  npx prisma db push
fi

# Optional seed (idempotent), run only if SEED=true
if [ "${SEED:-false}" = "true" ]; then
  echo "Running seed script..."
  npm run seed || true
fi

echo "Starting Next.js..."
exec npm start
