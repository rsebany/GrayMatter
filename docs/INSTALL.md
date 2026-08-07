# Installation

## Prerequisites

- Windows 10/11 + WSL2, Docker Desktop, Git

## Launch

```powershell
Copy-Item .env.example .env

# Download production weights (not in git):
# https://github.com/rsebany/GrayMatter/releases/tag/v1.0.0-coord-attention
# Save/rename the asset as ai/checkpoints/model.pt

New-Item -ItemType Directory -Force -Path ai/checkpoints | Out-Null
docker compose up --build -d
```

Open http://localhost — `researcher@graymatter.local` / `researcher12345`  
(local Docker seed only; set via `SEED_*` in `.env` — see `.env.example`)

| Service | URL |
|---------|-----|
| App | http://localhost |
| API | http://localhost/api |
| Health | http://localhost/api/health (`weights_exists: true` when `model.pt` is present) |

MRI data under `dataset/` is **not** required to run the UI. See [dataset/README.md](../dataset/README.md) only for training/OOF.

## Environment

| Variable | Role |
|----------|------|
| `DATABASE_URL` | PostgreSQL |
| `GRAYMATTER_JWT_SECRET` | JWT signing |
| `GRAYMATTER_SLICER_TOKEN_TTL_MINUTES` | Study-scoped Slicer write-token lifetime, 1–60 minutes |
| `GRAYMATTER_SEGMENTATION_REVISION_RETENTION` | Revision masks/history retained per study (current accepted revision is preserved) |
| `GRAYMATTER_EVENT_BACKEND` | `memory` for one API process, or `redis` for shared SSE fan-out |
| `GRAYMATTER_REDIS_URL` | Redis URL used when the event backend is `redis` |
| `GRAYMATTER_CORS_ORIGINS` | Comma-separated allowed browser origins; set explicit HTTPS origins in production |
| `GRAYMATTER_AI_ROOT` | `/app/ai` in Docker |
| `GRAYMATTER_CHECKPOINT` | `/app/ai/checkpoints/model.pt` |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` |
| `BACKEND_INTERNAL_URL` | `http://backend:8000` |

## Commands

```powershell
docker compose up --build -d
docker compose logs -f backend
docker compose down
```

## Multi-process and security notes

The default `memory` event backend is suitable for a single API process. Set
`GRAYMATTER_EVENT_BACKEND=redis` to use the Redis service included in
`docker-compose.yml` when multiple API workers must share segmentation SSE
events. If Redis configuration or connectivity is unavailable, the backend
falls back to process-local delivery and logs a warning without event payloads.
All workers must also share the same revision/mask storage volume; revision
activation uses per-study advisory lock files on that volume, and Redis does
not replace shared artifact storage. Validate advisory-lock behavior before
using network filesystems with unusual locking semantics.

For a shared deployment, replace all example passwords and JWT secrets, serve
the stack behind TLS, set explicit `GRAYMATTER_CORS_ORIGINS`, disable demo
`SEED_*` credentials, and back up database and revision storage. Sensitive API
responses use no-store and browser hardening headers. These controls support
practical deployment hardening but do not constitute PACS integration or
regulatory compliance.

## More

- Reproducibility: [REPRODUCIBILITY.md](REPRODUCIBILITY.md)
- Slicer: [SLICER.md](SLICER.md)
