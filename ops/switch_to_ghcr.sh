#!/usr/bin/env bash
set -euo pipefail
APP_DIR=${APP_DIR:-/opt/apps/sadd}
ORG=${ORG:-YOUR_GITHUB_ORG}
REPO=${REPO:-YOUR_REPO}
cd "$APP_DIR"
sed -i "s|ghcr.io/YOUR_GITHUB_ORG/YOUR_REPO|ghcr.io/${ORG}/${REPO}|g" docker-compose.ghcr.yml
docker login ghcr.io
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
echo "Switched to GHCR image-based deploy. Watchtower will auto-update."

