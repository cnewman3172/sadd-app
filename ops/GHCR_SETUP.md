GHCR + Watchtower Deployment

Overview
- GitHub Actions builds and pushes a Docker image to GHCR on every push to `main`.
- Your server runs `docker-compose.ghcr.yml` with Watchtower to auto‑pull new images.
- Cloudflare Tunnel (optional) exposes the app at your domain.

Repo Setup (one time)
- Create a GitHub repository and push this project to it.
- Ensure Actions are enabled for the repo and the package registry is allowed for the org/user.
- The workflow at `.github/workflows/deploy.yml` uses `GITHUB_TOKEN` to authenticate to GHCR. No extra secret is required to push.

Build on Push
- On `main` push, Actions builds and publishes:
  - `ghcr.io/<owner>/<repo>/web:latest`
  - `ghcr.io/<owner>/<repo>/web:<git-sha>`

Server Prep
1) Install the app with the provided installer if not already done:
   - `bash ops/install.sh APP_DIR=/opt/apps/sadd DOMAIN=your.domain.com`
2) Log in to GHCR so pulls can authenticate:
   - Create a GitHub Personal Access Token (classic) with `read:packages`.
   - On the server: `sudo docker login ghcr.io -u YOUR_GH_USERNAME -p YOUR_PAT`
3) Switch to GHCR compose and deploy:
   - `cd /opt/apps/sadd`
   - `ORG=YOUR_GH_ORG_OR_USER REPO=YOUR_REPO bash ops/switch_to_ghcr.sh`
   - This updates `docker-compose.ghcr.yml` to your `ghcr.io/<org>/<repo>` path, pulls, and starts.

Watchtower Auth Note
- `docker-compose.ghcr.yml` mounts `/root/.docker/config.json:/config.json:ro` for Watchtower, so it can pull private images.
- Ensure you performed `sudo docker login ghcr.io` so the root credential file exists.
- To avoid credentials, make your GHCR package public (repo → Packages → your image → change visibility).

Cloudflare Tunnel (optional)
- Put your token in `/opt/apps/sadd/.env` as `CF_TUNNEL_TOKEN=...`
- `docker compose -f docker-compose.ghcr.yml up -d cloudflared`
- Configure Public Hostname to `http://web:3000` in Cloudflare Zero Trust.

Update Flow After This
- Push to `main` on GitHub → Actions builds → Watchtower pulls within ~5 minutes → `web` restarts with the new image.

Manual Rollback (if needed)
- `cd /opt/apps/sadd`
- `docker compose -f docker-compose.ghcr.yml pull ghcr.io/<owner>/<repo>/web:<old-sha>` (or `docker pull`)
- `docker compose -f docker-compose.ghcr.yml up -d` after editing the `image:` tag temporarily to the old SHA.

