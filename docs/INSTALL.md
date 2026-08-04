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

## More

- Reproducibility: [REPRODUCIBILITY.md](REPRODUCIBILITY.md)
- Slicer: [SLICER.md](SLICER.md)
