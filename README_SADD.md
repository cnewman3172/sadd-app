SADD PWA (Docker, Cloudflare Tunnel, GitHub CI)

Quick Start (one command on your Ubuntu LTS server):

  curl -fsSL https://raw.githubusercontent.com/YOUR_GITHUB_ORG/YOUR_REPO/main/ops/install.sh | bash -s -- APP_DIR=/opt/apps/sadd DOMAIN=sadd.fwaboss.com REPO_URL=https://github.com/YOUR_GITHUB_ORG/YOUR_REPO.git

Then edit /opt/apps/sadd/.env, paste your Cloudflare Tunnel token (CF_TUNNEL_TOKEN=...), and run:

  cd /opt/apps/sadd && docker compose up -d cloudflared

All generated passwords/keys live in /opt/apps/sadd/.env.

First admin setup:

1) Register an account at https://sadd.fwaboss.com/login
2) On the server, run the admin promotion command printed by the installer.

Auto deploy:

- Preferred: GitHub Actions builds ghcr.io images on every push to main. Log in on the server with a GHCR token (read:packages) so Watchtower pulls new images automatically.

