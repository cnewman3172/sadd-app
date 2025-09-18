#!/bin/sh
set -eu

# Run database migrations, then start Next.js
echo "Running Prisma migrations..."
npx prisma migrate deploy || npx prisma db push

echo "Starting Next.js..."
exec npm start

