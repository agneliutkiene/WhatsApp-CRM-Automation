# Contributing

## Development setup

1. Install dependencies:
   - `npm run install:all`
2. Copy env files:
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env`
3. Run apps in two terminals:
   - `npm --prefix backend run dev`
   - `npm --prefix frontend run dev`

## Quality gate before PR

Run:

- `npm run check`

This runs backend lint + tests and frontend build checks.

## Branch and PR guidelines

- Keep PRs focused and small.
- Add/update tests when changing business logic.
- Update `README.md` or `DEPLOYMENT.md` when setup/runtime behavior changes.
- Do not commit credentials or `.env` files.

## Security requirements

- Never bypass webhook signature verification in production.
- Do not add bulk messaging, cold outreach, or spam automation.
- Prefer safe and policy-aligned automation paths.
