# Local Development

## 1) Install and boot

```bash
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Start backend and frontend:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

Open:
- UI: `http://localhost:5173`
- API health: `http://localhost:3001/api/health`

## 2) Useful checks

Run full project checks:

```bash
npm run check
```

Run only backend tests:

```bash
npm --prefix backend run test
```

## 3) Local data reset

MVP data is JSON-backed.

Default local file:
- `backend/src/data/db.json`

To reset local data:
1. Stop backend
2. Delete `backend/src/data/db.json`
3. Restart backend

## 4) Auth flow expectations

- First user signs up.
- After at least one account exists, auth modal defaults to login mode.
- Session uses cookie auth.

## 5) WhatsApp testing modes

CRM-only mode:
- Provide only `businessPhone`
- Messages save in CRM as mock delivery

Live delivery mode:
- Add `phoneNumberId` + `accessToken`
- Outbound messages go through Meta API

Inbound webhook mode:
- Add `verifyToken`
- Configure Meta callback to `/api/integrations/whatsapp/webhook`
