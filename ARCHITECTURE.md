# Architecture

## System overview

Single deploy model:
- Backend serves REST API under `/api/*`
- Backend also serves built Vue frontend under `/`

## Request/data flow

1. User interacts with dashboard UI.
2. Frontend calls backend API (`frontend/src/api.js`).
3. Backend resolves authenticated user from session cookie.
4. Services run workspace-scoped logic.
5. Data is persisted to JSON store (MVP).
6. Optional worker sends follow-up reminders on interval.

## Backend components

- `backend/src/index.js`: app bootstrap, middleware, route mounting
- `backend/src/middleware/sessionAuth.js`: session attach + auth guard
- `backend/src/middleware/apiAuth.js`: optional extra `APP_PASSWORD` gate
- `backend/src/routes/`: HTTP route layer
- `backend/src/services/authService.js`: registration, login, sessions
- `backend/src/services/crmService.js`: conversations, templates, automation, analytics
- `backend/src/services/whatsappService.js`: config, connection status, Meta send API
- `backend/src/services/automationWorker.js`: periodic follow-up sender
- `backend/src/utils/store.js`: JSON persistence and workspace hydration

## Frontend components

- `frontend/src/App.vue`: main application UI and state orchestration
- `frontend/src/api.js`: fetch wrapper and endpoint client
- `frontend/src/style.css`: global styles

## Multi-user isolation

- Each account has its own workspace record.
- Workspace includes:
  - conversations
  - messages
  - templates
  - automation settings
  - WhatsApp connection settings
- API operations always scope to `req.userId`.

## WhatsApp connection capabilities

- Required for "connected" state:
  - `businessPhone`
- Required for live outbound delivery:
  - `phoneNumberId`
  - `accessToken`
- Required for Meta webhook verification handshake:
  - `verifyToken`

Without live delivery credentials, the app still works in CRM-only mode.

## Persistence strategy

Current:
- JSON file storage via `backend/src/utils/store.js`
- Production path can be forced using `DATA_FILE_PATH`

Planned:
- Move to PostgreSQL/MySQL repository layer
- Keep JSON mode for local/demo

## Security controls

- HTTP-only auth cookies (session auth)
- Optional extra API password gate (`APP_PASSWORD`)
- Webhook verification token check
- Signature verification for webhook POST when `WHATSAPP_APP_SECRET` is set

## Known limits

- JSON storage is not suitable for high concurrency.
- Single-process worker can duplicate sends if multiple instances run.
