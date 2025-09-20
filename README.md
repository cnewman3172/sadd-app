SADD — Soldiers Against Drunk Driving web app

## Deployment

- Docker Compose is provided for both local builds (`docker-compose.yml`) and GHCR pull (`docker-compose.ghcr.yml`).
- The app listens on port 3000. Expose/forward 3000 only.
- GHCR deploys: `pull_policy: always` ensures `up -d` pulls latest images. Watchtower can auto-update.

### Environment

Copy `.env.example` to `.env` and set values:

- `DATABASE_URL`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`
- `SETUP_KEY` one-time admin bootstrap key (remove after use)
- `OSRM_URL`, `NOMINATIM_URL` for routing/geocode
- Rate limits: `RATE_LIMIT_PER_MINUTE`, `PING_MIN_INTERVAL_MS`, `AUTH_RATE_LIMIT_PER_MIN`
- Optional Sentry:
  - Server: `SENTRY_DSN`
  - Client: `NEXT_PUBLIC_SENTRY_DSN`
  - Traces: `SENTRY_TRACES_SAMPLE_RATE` (0.0–1.0)

### Cloudflare Tunnel

- Use the `cloudflared` service with `CF_TUNNEL_TOKEN`.
- Public Hostname → `http://web:3000` (or `http://sadd_web:3000`).

### Database

- Postgres runs in `db` with volume `sadd-db`.
- First start will baseline migrations automatically if the schema exists, otherwise applies `db push`.
- Optional seeding: set `SEED=true` with `SEED_ADMIN_EMAIL`, etc., for a one-time seed.

### Smoke Test

Simple health check:

```
curl -fsS http://localhost:3000/api/health | jq .
```
