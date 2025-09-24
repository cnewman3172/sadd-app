GHCR deployment and updates

Overview
- The workflow `.github/workflows/deploy.yml` pushes two tags to GHCR on every push to `main`:
  - `ghcr.io/<owner>/<repo>/web:latest`
  - `ghcr.io/<owner>/<repo>/web:<git-sha>`
- `docker-compose.ghcr.yml` is set to pull `web:${WEB_TAG:-latest}` and includes Watchtower to auto‑update.

One‑time setup
- Login to GHCR on the host that runs Docker:
  - `docker login ghcr.io -u <github-username> -p <PAT-with-read:packages>`
- Ensure Watchtower can read your Docker auth:
  - If your Docker config is at `~/.docker`, export `DOCKER_CONFIG=~/.docker` before running compose; or add it to your `.env`.

Force an update to the newest image
- Pull and recreate just the web service:
  - `docker compose -f docker-compose.ghcr.yml pull web`
  - `docker compose -f docker-compose.ghcr.yml up -d web`
- Verify the running image digest matches the registry:
  - Local: `docker inspect --format='{{index .RepoDigests 0}}' sadd_web`
  - Remote: `docker buildx imagetools inspect ghcr.io/<owner>/<repo>/web:${WEB_TAG:-latest}`

Avoid “latest” drift
- Prefer immutable tags tied to commits:
  - Set `WEB_TAG` to a Git SHA (from the Actions build). Example: `export WEB_TAG=ab12cd34` then `docker compose -f docker-compose.ghcr.yml up -d`.
- Or put `WEB_TAG=ab12cd34` in a `.env` file next to the compose file.

Watchtower tips
- If images are private, make sure `DOCKER_CONFIG` is mounted (see compose file) and contains a `config.json` with GHCR auth.
- Check logs: `docker logs sadd_watchtower` — it should report pulls every 5 minutes per the schedule.
- You can scope updates by labels; `web` already has `com.centurylinklabs.watchtower.enable=true`.

Common pitfalls
- Using `docker compose up -d` without `pull` won’t refresh `latest` on many Compose versions.
- Missing GHCR auth causes Watchtower to silently skip private images; mount the correct `DOCKER_CONFIG` path.
- Older Compose versions may ignore `pull_policy: always`. Use `docker compose version` ≥ v2.15 or run an explicit `pull`.

