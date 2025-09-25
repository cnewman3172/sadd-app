SADD PWA (Docker, Cloudflare Tunnel, GitHub CI)

Quick Start (one command from this folder on your Ubuntu LTS server):

  bash ops/install.sh APP_DIR=/opt/apps/sadd DOMAIN=sadd.example.com

Then edit /opt/apps/sadd/.env, paste your Cloudflare Tunnel token (CF_TUNNEL_TOKEN=...) if you use Cloudflare, and run:

  cd /opt/apps/sadd && docker compose up -d cloudflared

All generated passwords/keys live in /opt/apps/sadd/.env.

First admin setup:

1) Register an account at https://sadd.example.com/login
2) Promote to ADMIN with the one-liner printed by the installer (uses /api/admin/promote and your generated SETUP_KEY).

Auto deploy:

- Preferred: GitHub Actions builds ghcr.io images on every push to main. Log in on the server with a GHCR token (read:packages) so Watchtower pulls new images automatically.

Driver operations (TC role):

- Go online: select a van on `/driving` and click Go Online. This sets you as the active TC for that van.
- Tasks: `/driving` lists rides assigned to your van. Update status through En Route → Picked Up → Dropped.

API quick refs:

- `POST /api/driver/go-online` body `{ vanId }`
- `POST /api/driver/go-offline`
- `GET /api/driver/tasks` → `{ van, tasks }`
- `PUT /api/rides/:id` body may include `{ status, vanId }`; if `vanId` provided and that van has an `activeTcId`, the ride's `driverId` auto-fills with that TC.

Export and Reporting

- Rides export (XLSX): Executives → Analytics → “Export (XLSX: Rides + Training)”.
- Columns (Rides sheet):
  - rider_name, rider_rank, rider_email, rider_phone, rider_unit,
    truck_commander_name, truck_commander_email, van_name,
    requested_at, picked_up_at, dropped_at, pickup_address,
    dropoff_address, status, rating, review_comment, time_zone.
- Notes:
  - Contact name/phone override rider_name and rider_phone; contact columns are not included to avoid duplicates.
  - Passengers column removed. SADD now treats each request as one passenger; additional riders must be entered as “walk‑on” by TC for accurate individual drop times.
- Training sheet: includes only volunteer roles (SAFETY, DRIVER, TC, DISPATCHER, ADMIN). Status fields are “Completed” or “Not Completed”.
