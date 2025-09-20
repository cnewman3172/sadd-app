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

# Run migrations (skip noisy P3005 if no migrations exist)
echo "Running Prisma migrations..."
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null | wc -l)" -gt 0 ]; then
  npx prisma migrate deploy || true
else
  echo "No migrations directory; applying schema via db push"
fi
npx prisma db push

echo "Starting Next.js..."
exec npm start
