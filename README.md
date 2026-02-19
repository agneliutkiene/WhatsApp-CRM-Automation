# WhatsApp CRM & Automation App

A full-stack starter for the WhatsApp CRM & Automation:

- `frontend`: Vue 3 + Vite web dashboard
- `backend`: Node.js + Express API with safe automation logic

This app is designed as a lightweight operational CRM.

## What is included

### Core inbox and CRM workflow
- Unified conversation list with state: `NEW`, `FOLLOW_UP`, `CLOSED`
- Conversation timeline (inbound/outbound messages)
- Notes per conversation
- Search and state filters

### Follow-up system
- Set follow-up datetime per conversation
- Background worker checks due follow-ups every minute
- Reminder messages can be sent automatically (safe mode)

### Safe automation
- Auto-reply on first inquiry
- After-hours reply template
- Follow-up reminder template
- Automation settings editable in dashboard

### Lightweight analytics
- New inquiries today
- Pending follow-ups
- Closed conversations
- Total conversations

### Integrations
- WordPress lead ingestion endpoint (structured lead -> conversation)
- WhatsApp webhook endpoint (Meta Cloud API compatible structure)
- WhatsApp message sending integration hook (uses Meta API when credentials are configured)

## Project structure

- `/Users/agneliutkiene/Documents/New project/frontend`
- `/Users/agneliutkiene/Documents/New project/backend`

## Local run

### 1) Install dependencies

```bash
cd "/Users/agneliutkiene/Documents/New project/backend"
npm install

cd "/Users/agneliutkiene/Documents/New project/frontend"
npm install
```

### 2) Configure environment

```bash
cd "/Users/agneliutkiene/Documents/New project/backend"
cp .env.example .env

cd "/Users/agneliutkiene/Documents/New project/frontend"
cp .env.example .env
```

### 3) Start backend

```bash
cd "/Users/agneliutkiene/Documents/New project/backend"
npm run dev
```

Backend default URL: `http://localhost:3001`

### 4) Start frontend

```bash
cd "/Users/agneliutkiene/Documents/New project/frontend"
npm run dev
```

Frontend default URL: `http://localhost:5173`

## API overview

### Health
- `GET /api/health`

### Conversations
- `GET /api/conversations?state=NEW&search=term`
- `GET /api/conversations/:id`
- `PATCH /api/conversations/:id` (`state`, `followUpAt`)
- `POST /api/conversations/:id/notes`
- `POST /api/conversations/:id/messages`
- `POST /api/conversations/ingest/inbound` (manual simulation)
- `GET /api/conversations/follow-ups/pending`

### Templates
- `GET /api/templates`
- `POST /api/templates`
- `PATCH /api/templates/:id`

### Automation
- `GET /api/automation`
- `PATCH /api/automation`

### Analytics
- `GET /api/analytics/today`

### Integrations
- `POST /api/integrations/wordpress/lead`
- `GET /api/integrations/whatsapp/webhook` (verification)
- `POST /api/integrations/whatsapp/webhook`

## Hostinger deployment notes

- Deploy a single Node.js app with root `backend` and entry `src/index.js`.
- Backend now builds frontend during `postinstall` and serves it at `/`.
- API remains under `/api/*`.
- Set environment variables from `backend/.env.example`.
- Full step-by-step guide: `DEPLOYMENT.md`.

## Production hardening recommended next

- Auth + role-based access (owner/agent)
- Real database (PostgreSQL/MySQL)
- Retry queue for failed WhatsApp sends
- Per-tenant isolation for hosted multi-instance rollout
- Audit logs and webhook signature validation
- Backup and restore tooling
