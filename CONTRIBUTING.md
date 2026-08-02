# Contributing to GRAYMATTER

Thanks for contributing. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Run the app first

Follow the root [README.md](README.md) quick start (weights + `.env` + Docker). Details: [docs/INSTALL.md](docs/INSTALL.md).

## How to contribute

1. Fork and clone; branch from `develop` (not `main`).
2. Prefer issues labeled `good first issue` or `help wanted`; comment before starting.
3. Keep PRs focused; update docs only when behavior or setup changes.

### Bugs

Include title, steps to reproduce, expected vs actual, OS/Docker version, and relevant logs.

### Pull requests

- Branches: `feature/…`, `fix/…`, `hotfix/…`, `docs/…`
- Target `develop`
- Checklist: style OK, docs updated if needed, no new errors, tested locally

```bash
# Frontend
cd frontend && npm run lint && npm run build

# Backend / AI (from repo root, with venv)
python -m compileall backend ai
```

## Coding standards

- **Python:** 3.11+, type hints on public APIs, match existing style under `backend/` and `ai/`
- **TypeScript / React:** Next.js App Router patterns already in `frontend/`
- **Commits:** short imperative subject; explain *why* in the body when needed

## Security

Do not open public issues for vulnerabilities — see [SECURITY.md](SECURITY.md).

## Questions

Open a GitHub Discussion or issue, or email romualdosebany@gmail.com.
