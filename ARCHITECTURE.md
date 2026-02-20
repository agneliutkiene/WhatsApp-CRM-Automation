# Architecture

## High-level flow

1. Inbound events arrive via:
   - WhatsApp webhook: `/api/integrations/whatsapp/webhook`
   - Website leads: `/api/integrations/wordpress/lead`
2. Backend normalizes payloads into conversations/messages.
3. Automation rules optionally send safe responses.
4. Frontend consumes `/api/*` and renders Inbox/Conversation/Automation/CRM views.

## Backend modules

- `src/routes/*`: HTTP boundary and request validation.
- `src/services/crmService.js`: CRM workflows, conversation/message state changes.
- `src/services/whatsappService.js`: WhatsApp config + provider send API.
- `src/services/automationWorker.js`: periodic follow-up reminder processor.
- `src/utils/store.js`: persistence layer (JSON file in MVP).

## Frontend modules

- `frontend/src/App.vue`: main dashboard shell and UI state.
- `frontend/src/api.js`: API client and app-password header logic.

## Persistence

Current MVP stores data in `backend/src/data/db.json`.

Planned upgrade path:

1. Introduce repository layer abstraction.
2. Implement SQL-backed repository (PostgreSQL/MySQL).
3. Keep JSON repository for local demo mode.

## Security controls

- Optional app-level API password (`APP_PASSWORD`).
- WhatsApp webhook verification token check.
- Signature verification for webhook POST when `WHATSAPP_APP_SECRET` is configured.

## Known scaling limits

- Local JSON storage is not safe for horizontal scaling.
- In-process scheduler (`setInterval`) can duplicate sends across multiple instances.
