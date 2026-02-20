# WhatsApp CRM & Automation

Lightweight WhatsApp operations layer for small businesses:

- Unified inbox with states (`NEW`, `FOLLOW_UP`, `CLOSED`)
- Follow-up scheduling and reminder automation
- Templates and safe reply automation
- CRM lead board and lead ingestion endpoints
- Single-domain deploy (API + frontend) for Hostinger Node.js hosting

## Repository health

- CI: GitHub Actions runs build + backend checks on push/PR
- License: MIT (`LICENSE`)
- Contribution guide: `CONTRIBUTING.md`

## Tech stack

- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Storage (MVP): local JSON (`backend/src/data/db.json`)

## Quick start (local)

1. Install dependencies:
```bash
npm run install:all
```

2. Create env files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Start backend:
```bash
npm --prefix backend run dev
```

4. Start frontend:
```bash
npm --prefix frontend run dev
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:3001`

## Scripts

Root:

- `npm run install:all` install backend + frontend deps
- `npm run check` run backend checks + frontend build check
- `npm run build` build frontend and backend-served frontend dist

Backend:

- `npm --prefix backend run dev`
- `npm --prefix backend run start`
- `npm --prefix backend run lint`
- `npm --prefix backend run test`
- `npm --prefix backend run check`
- `npm --prefix backend run build:frontend`

Frontend:

- `npm --prefix frontend run dev`
- `npm --prefix frontend run build`
- `npm --prefix frontend run build:backend-dist`
- `npm --prefix frontend run check`

## API overview

- `GET /api/health`
- `GET /api/conversations`
- `GET /api/conversations/:id`
- `PATCH /api/conversations/:id`
- `POST /api/conversations/:id/notes`
- `POST /api/conversations/:id/messages`
- `POST /api/conversations/ingest/inbound`
- `GET /api/conversations/follow-ups/pending`
- `GET /api/templates`
- `POST /api/templates`
- `PATCH /api/templates/:id`
- `GET /api/automation`
- `GET /api/automation/safety`
- `PATCH /api/automation`
- `GET /api/analytics/today`
- `POST /api/integrations/wordpress/lead`
- `GET /api/integrations/whatsapp/status`
- `PATCH /api/integrations/whatsapp/config`
- `POST /api/integrations/whatsapp/confirm-webhook`
- `POST /api/integrations/whatsapp/test-message`
- `GET /api/integrations/whatsapp/webhook`
- `POST /api/integrations/whatsapp/webhook`

## Environment variables (backend)

Required for production:

- `NODE_ENV=production`
- `APP_BASE_URL=https://<your-domain>`

Recommended:

- `APP_PASSWORD=<strong-password>`
- `WHATSAPP_APP_SECRET=<meta-app-secret>` (enables webhook signature verification)

Optional WhatsApp Cloud API:

- `WHATSAPP_ACCESS_TOKEN=...`
- `WHATSAPP_PHONE_NUMBER_ID=...`
- `WHATSAPP_VERIFY_TOKEN=...`

Business-hour defaults:

- `APP_TIMEZONE=Asia/Kolkata`
- `BUSINESS_HOURS_START=09:00`
- `BUSINESS_HOURS_END=19:00`

## Deployment

See `DEPLOYMENT.md` for Hostinger-specific steps.

## Notes for contributors

- `frontend/` is the primary frontend source.
- Backend deploy builds frontend into `backend/frontend/dist` via `build:frontend`.
- Avoid editing generated `dist` artifacts.

## Production hardening roadmap

- Move from JSON storage to PostgreSQL/MySQL
- Add role-based auth (owner/agent)
- Add webhook replay protection/idempotency
- Add retry queue for failed outbound sends
- Add structured logging and audit trails
