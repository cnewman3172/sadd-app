#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/apps/sadd}
REPO_URL=${REPO_URL:-}
DOMAIN=${DOMAIN:-sadd.fwaboss.com}

echo "==> SADD installer starting"

if ! command -v docker >/dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi

if ! command -v docker compose >/dev/null; then
  echo "Installing docker compose plugin..."
  DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
  mkdir -p "$DOCKER_CONFIG/cli-plugins"
  curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
  chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
fi

# Choose docker invocation (sudo if needed for current session)
DOCKER=docker
if ! docker ps >/dev/null 2>&1; then
  if command -v sudo >/dev/null; then
    DOCKER="sudo docker"
  fi
fi

sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

if [ -n "$REPO_URL" ]; then
  echo "==> Cloning repo $REPO_URL"
  if [ ! -d "$APP_DIR/.git" ]; then
    git clone "$REPO_URL" "$APP_DIR"
  else
    git -C "$APP_DIR" pull --ff-only
  fi
else
  echo "==> Copying files from current directory"
  rsync -a --exclude node_modules --exclude .git ./ "$APP_DIR/"
fi

cd "$APP_DIR"

ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "==> Generating .env"
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 32)
  SETUP_KEY=$(openssl rand -hex 16)
  NEXT_PUBLIC_APP_URL="https://$DOMAIN"
  DATABASE_URL="postgresql://sadd:${POSTGRES_PASSWORD}@db:5432/sadd"

  # Generate VAPID via a temporary Node container
  VAPID=$($DOCKER run --rm node:20-alpine sh -lc "npm -s add web-push >/dev/null 2>&1 && node -e 'const wp=require(\"web-push\");const k=wp.generateVAPIDKeys();console.log(k.publicKey+\"\n\"+k.privateKey)'" )
  VAPID_PUBLIC_KEY=$(echo "$VAPID" | sed -n '1p')
  VAPID_PRIVATE_KEY=$(echo "$VAPID" | sed -n '2p')

  cat > "$ENV_FILE" <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET
NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY
CF_TUNNEL_TOKEN=
OSRM_URL=https://router.project-osrm.org
NOMINATIM_URL=https://nominatim.openstreetmap.org
RATE_LIMIT_PER_MINUTE=60
PING_MIN_INTERVAL_MS=3000
SETUP_KEY=$SETUP_KEY
EOF
fi

echo "==> Applying database schema"
$DOCKER compose run --rm web npx prisma db push

echo "==> Bringing up containers"
$DOCKER compose up -d --build

echo "==> DONE"
echo
echo "SADD is starting. Next steps:"
echo "1) Cloudflare Tunnel: open $APP_DIR/.env and paste your CF_TUNNEL_TOKEN= value from Cloudflare Zero Trust (Tunnel > Create > Token)."
echo "   Then run: docker compose up -d cloudflared"
echo "2) First admin: register an account at $DOMAIN/login, then on the server run:"
echo "   curl -X POST https://$DOMAIN/api/admin/promote -H 'Content-Type: application/json' -H 'x-setup-key: $SETUP_KEY' -d '{\"email\":\"YOUR_EMAIL\",\"role\":\"ADMIN\"}'"
echo "3) Passwords & keys are stored in $ENV_FILE"
echo "4) Auto-deploy:"
echo "   - Preferred: use GHCR + Watchtower. In GitHub, enable Actions and Packages."
echo "   - Or set up the built-in timer: sudo systemctl enable --now sadd-updater.timer (after creating repo clone)."
