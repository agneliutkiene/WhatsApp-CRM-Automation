# Contributing

## Prerequisites

- Node.js 20.x
- npm 10+
- Git

## First run

1. Install dependencies:
```bash
npm run install:all
```

2. Copy env templates:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Start apps in two terminals:
```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

## Before opening a PR

Run full checks:
```bash
npm run check
```

This runs:
- Backend syntax lint + tests
- Frontend production build check

## PR scope and expectations

- Keep PRs focused (one concern per PR).
- Add or update tests for backend logic changes.
- Update docs when behavior/config/deployment changes.
- Never commit secrets, tokens, or `.env` files.

## Commit style (recommended)

Use clear prefixes:
- `feat:` new feature
- `fix:` bug fix
- `ui:` UX/CSS changes
- `docs:` documentation-only changes
- `chore:` tooling/refactor/non-feature maintenance

## Security guardrails

- Do not add bulk messaging, cold outreach, or spam workflows.
- Keep automation policy-aligned and safe by default.
- Keep webhook signature verification enabled in production (`WHATSAPP_APP_SECRET`).

## Branching model

- Base branch: `main`
- Create feature branches from `main`
- Rebase/merge latest `main` before opening PR if needed

## Where to look in code

- API routes: `backend/src/routes/`
- Core business logic: `backend/src/services/`
- Persistence layer: `backend/src/utils/store.js`
- Frontend UI: `frontend/src/App.vue`
- Frontend API client: `frontend/src/api.js`
