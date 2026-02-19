# Deployment Guide (Hostinger)

This guide deploys your WhatsApp CRM app from:

- Backend: `/Users/agneliutkiene/Documents/New project/backend` (Node.js + Express)
- Frontend: `/Users/agneliutkiene/Documents/New project/frontend` (Vue + Vite)

Recommended production setup:

- `api.yourdomain.com` -> backend Node.js app
- `yourdomain.com` -> frontend static site

## 1) Prerequisites

- GitHub repo is up to date: `https://github.com/agneliutkiene/WhatsApp-template`
- Hostinger plan with:
  - Managed Node.js Hosting (for backend)
  - Website hosting/static files (for frontend)
- Node.js version: `>= 18.17.0`
- Optional (for real WhatsApp sending):
  - Meta WhatsApp Cloud API access token
  - Meta phone number ID
  - Verify token you define

## 2) Backend deployment (Node.js on Hostinger)

### 2.1 Create Node.js app in hPanel

1. Open Hostinger hPanel.
2. Create/select domain or subdomain for API (recommended `api.yourdomain.com`).
3. Open **Node.js** section and create an app.
4. Set startup file to:

`backend/src/index.js`

5. Set app root to the repository root where `backend/` exists.

### 2.2 Install backend dependencies

In Hostinger terminal/SSH for your app directory:

```bash
cd backend
npm ci --omit=dev
```

### 2.3 Configure backend environment variables

In Hostinger app environment settings, add:

- `NODE_ENV=production`
- `PORT` (if required by Hostinger; otherwise platform-managed)
- `WHATSAPP_ACCESS_TOKEN=<your_meta_token>`
- `WHATSAPP_PHONE_NUMBER_ID=<your_phone_number_id>`
- `WHATSAPP_VERIFY_TOKEN=<your_custom_verify_token>`
- `APP_TIMEZONE=Asia/Kolkata`
- `BUSINESS_HOURS_START=09:00`
- `BUSINESS_HOURS_END=19:00`

Important:

- If you are not ready for real WhatsApp sending, leave token/phone ID empty.
- The app will still run, and outbound sends will be mocked safely.

### 2.4 Start/restart backend

Start or restart the Node.js app from hPanel.

### 2.5 Verify backend is live

Open:

- `https://api.yourdomain.com/api/health`

Expected JSON contains `"status":"ok"`.

## 3) Frontend deployment (static site)

### 3.1 Build frontend with production API URL

On your local machine:

```bash
cd "/Users/agneliutkiene/Documents/New project/frontend"
VITE_API_BASE_URL="https://api.yourdomain.com/api" npm run build
```

This creates:

- `frontend/dist/`

### 3.2 Upload frontend build to Hostinger

Upload contents of `frontend/dist/` to your website public directory (typically `public_html`).

Rules:

- Upload the files inside `dist`, not the folder itself.
- `index.html` should end up directly in `public_html`.

### 3.3 Verify frontend

Open:

- `https://yourdomain.com`

Dashboard should load and fetch data from `https://api.yourdomain.com/api`.

## 4) WhatsApp webhook configuration (Meta)

In Meta app/webhook settings:

- Callback URL: `https://api.yourdomain.com/api/integrations/whatsapp/webhook`
- Verify token: same value as `WHATSAPP_VERIFY_TOKEN`

Subscribe to relevant WhatsApp message events.

Quick check (GET verify endpoint) happens automatically when Meta validates webhook.

## 5) WordPress form integration

Send lead data from your WordPress form/plugin to:

- `POST https://api.yourdomain.com/api/integrations/wordpress/lead`

JSON body example:

```json
{
  "name": "Ravi",
  "phone": "+919876543210",
  "message": "Need pricing for tutoring",
  "sourceUrl": "https://yourdomain.com/contact"
}
```

Required fields: `phone`, `message`.

## 6) Post-deploy smoke test checklist

1. Open frontend and confirm inbox renders.
2. Open `https://api.yourdomain.com/api/health`.
3. Use **Inbound Simulation** in UI; verify conversation appears.
4. Set one conversation to `FOLLOW_UP` with a near-term follow-up time.
5. Wait ~1 minute; verify reminder message appears.
6. Create and use a template; verify message is logged.
7. (If Meta credentials configured) verify real WhatsApp outbound delivery.

## 7) Updating after code changes

After new pushes to GitHub:

### Backend

```bash
cd backend
git pull origin main
npm ci --omit=dev
```

Restart backend app in hPanel.

### Frontend

```bash
cd "/Users/agneliutkiene/Documents/New project/frontend"
VITE_API_BASE_URL="https://api.yourdomain.com/api" npm run build
```

Upload refreshed `frontend/dist/` to `public_html`.

## 8) Data persistence warning

Current MVP stores data in local JSON file:

- `backend/src/data/db.json`

For production reliability, migrate to PostgreSQL/MySQL soon.

Until migration, ensure your hosting environment keeps app filesystem persistent across restarts/redeploys.

## 9) Security hardening before scale

- Add dashboard authentication (login + session/JWT).
- Restrict CORS to your frontend domain.
- Validate and sign webhook payloads.
- Add rate limiting on public endpoints.
- Store secrets only in Hostinger environment variables.

## 10) Go-live checklist

- Repo visibility set to Public in GitHub settings
- Backend healthy on HTTPS
- Frontend connected to backend API
- WhatsApp webhook verified
- WordPress leads reaching CRM
- First real inbound/outbound message tested
