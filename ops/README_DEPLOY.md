Single-command install (to run on your Ubuntu LTS server):

curl -fsSL https://raw.githubusercontent.com/your/repo/main/ops/install.sh | bash -s -- APP_DIR=/opt/apps/sadd DOMAIN=sadd.fwaboss.com REPO_URL=https://github.com/your/repo.git

After it completes:

- Open /opt/apps/sadd/.env and paste your Cloudflare tunnel token (CF_TUNNEL_TOKEN=...). Then run: docker compose up -d cloudflared
- Promote your first account to ADMIN as printed by the installer.
- All generated secrets live in /opt/apps/sadd/.env

GitHub Actions builds the image ghcr.io/owner/repo/web:latest on push to main. Watchtower in docker-compose pulls new images automatically if you provide GHCR auth on the server (docker login ghcr.io).

