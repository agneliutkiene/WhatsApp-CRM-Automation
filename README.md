# WhatsApp CRM & Automation

[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/web-apps-hosting)

WhatsApp CRM control layer built for small teams and solo operators.

It adds structure on top of WhatsApp by providing:
- Conversation states (`NEW`, `FOLLOW_UP`, `CLOSED`)
- Follow-up planning and reminder automation
- Reusable response templates
- Lead capture and CRM board
- Per-user authentication and isolated workspaces

## Quick start (5 minutes)

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

5. Open:
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3001/api/health`

## Repo layout

- `frontend/` Vue app (UI)
- `backend/` Express API + automation worker
- `backend/src/routes/` API endpoints
- `backend/src/services/` business logic
- `backend/src/utils/store.js` JSON persistence layer (MVP)
- `.github/workflows/ci.yml` CI checks

## Daily developer workflow

Run checks before pushing:
```bash
npm run check
```

Useful commands:
- `npm --prefix backend run dev`
- `npm --prefix frontend run dev`
- `npm --prefix backend run test`
- `npm --prefix backend run lint`
- `npm --prefix backend run build:frontend`

## Authentication model

- Users sign up/login with email + password.
- Sessions are HTTP-only cookies.
- Each user gets a separate workspace:
  - Conversations/messages
  - Templates/automation
  - WhatsApp connection settings

## WhatsApp capability model

Connection fields and behavior:
- `businessPhone` (required): marks WhatsApp as connected in CRM mode
- `phoneNumberId` + `accessToken` (optional): required for live Meta delivery
- `verifyToken` (optional): needed for Meta webhook verification

If live credentials are missing, send actions run in CRM-only mock mode and warn the user.

## Environment variables

Required for production:
- `NODE_ENV=production`
- `APP_BASE_URL=https://<your-domain>`

Strongly recommended in production:
- `DATA_FILE_PATH=/absolute/path/to/db.json` (durable storage)
- `WHATSAPP_APP_SECRET=...` (webhook signature verification)

Optional:
- `APP_PASSWORD=...` (extra gate for non-session API requests)
- `AUTH_SESSION_DAYS=14`
- `WHATSAPP_ACCESS_TOKEN=...`
- `WHATSAPP_PHONE_NUMBER_ID=...`
- `WHATSAPP_VERIFY_TOKEN=...`
- `APP_TIMEZONE=Asia/Kolkata`
- `BUSINESS_HOURS_START=09:00`
- `BUSINESS_HOURS_END=19:00`

## API surface

Main groups:
- `GET /api/health`
- `GET /api/auth/bootstrap`
- `GET /api/auth/me`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/conversations`
- `GET /api/templates`
- `GET /api/automation`
- `GET /api/analytics/today`
- `PATCH /api/integrations/whatsapp/config`
- `POST /api/integrations/wordpress/lead`
- `GET/POST /api/integrations/whatsapp/webhook`

## Documentation map

- Deployment: `DEPLOYMENT.md`
- Architecture: `ARCHITECTURE.md`
- Contributing: `CONTRIBUTING.md`
- Local dev details: `docs/LOCAL_DEVELOPMENT.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`

## Production limitations (current MVP)

- JSON storage is not designed for horizontal scaling.
- In-process scheduler can duplicate reminders if many instances run in parallel.
- DB migration (PostgreSQL/MySQL) is the next major upgrade path.
