# Deployment Guide (Hostinger, Single Deploy)

This project is configured so one Node.js deployment can serve both:

- API routes under `/api/*`
- Vue frontend at `/`

This is the best path when Hostinger locks your app root to `backend`.

## 1) Required Hostinger settings

In your Node.js deployment settings use:

- Framework preset: `Express`
- Branch: `main`
- Node version: `20.x`
- Root directory: `backend`
- Entry file: `src/index.js`
- Package manager: `npm`

## 2) Environment variables

Add these variables:

- `NODE_ENV=production`
- `APP_TIMEZONE=Asia/Kolkata`
- `BUSINESS_HOURS_START=09:00`
- `BUSINESS_HOURS_END=19:00`
- `APP_BASE_URL=https://<your-temp-domain>`

Optional (for real WhatsApp sending):

- `WHATSAPP_ACCESS_TOKEN=...`
- `WHATSAPP_PHONE_NUMBER_ID=...`
- `WHATSAPP_VERIFY_TOKEN=...`

Optional (recommended on public domains):

- `APP_PASSWORD=<strong-password>`

## 3) Deploy

Click Deploy/Finish.

What happens during install:

1. Hostinger installs backend dependencies.
2. Backend `postinstall` runs.
3. `postinstall` builds frontend from `./frontend`.
4. Backend serves built frontend from `frontend/dist`.

## 4) Verify

Check both URLs:

- Health: `https://<your-temp-domain>/api/health`
- App: `https://<your-temp-domain>/`

Expected:

- `/api/health` returns JSON with `status: ok`
- `/` loads WhatsApp CRM UI

## 5) If deployment fails

Open Hostinger build/runtime logs and check first error.

Common fixes:

1. Node version must be `20.x`.
2. Root directory must be `backend`.
3. Entry file must be `src/index.js`.
4. If npm install fails, redeploy after clearing cache.

## 6) Updating app after Git push

Every push to `main` can redeploy automatically (if auto-deploy enabled).

Manual redeploy flow:

1. Open deployment in Hostinger.
2. Click Redeploy.
3. Re-check `/api/health` and `/`.

## 7) WordPress lead webhook endpoint

Use this URL in WordPress form automation:

- `POST https://<your-temp-domain>/api/integrations/wordpress/lead`

Body example:

```json
{
  "name": "Ravi",
  "phone": "+919876543210",
  "message": "Need pricing for tutoring",
  "sourceUrl": "https://your-site.com/contact"
}
```

## 8) WhatsApp webhook endpoint (Meta)

In Meta developer console:

- Callback URL: `https://<your-temp-domain>/api/integrations/whatsapp/webhook`
- Verify token: same as `WHATSAPP_VERIFY_TOKEN`

In the app UI, open **Setup checklist** and complete:

1. Connect credentials
2. Confirm webhook step
3. Send setup test message

## 9) Production note

Current MVP stores CRM data in local JSON file:

- `backend/src/data/db.json`

For scale/reliability, migrate to MySQL/PostgreSQL.
