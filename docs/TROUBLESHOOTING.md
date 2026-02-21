# Troubleshooting

## Cannot login with existing account

Symptoms:
- User signed up before but cannot login now.

Checks:
1. Confirm account exists by opening auth modal and trying login mode.
2. Verify backend persistence path is durable in production:
   - Set `DATA_FILE_PATH=/absolute/path/to/db.json`
3. Confirm deployment is using same storage path after redeploy.

## Login error message not visible

Current behavior:
- Invalid credentials should display inline inside the auth modal.

If not visible:
1. Hard refresh browser
2. Confirm latest deployment is live

## Signup says account already exists

Expected behavior:
- UI switches to login mode and prompts login.

## Messages are not reaching WhatsApp

Check capability setup:
- `businessPhone` only: CRM-only mode (mock delivery)
- For live delivery you must add:
  - `phoneNumberId`
  - `accessToken`

## Webhook verify fails in Meta

Verify:
- Callback URL: `https://<domain>/api/integrations/whatsapp/webhook`
- Verify token matches app config
- If signature verification enabled, `WHATSAPP_APP_SECRET` is correct

## Deployment fails on Hostinger

Verify settings:
- Preset: `Express`
- Root directory: `backend`
- Entry file: `index.js`
- Node: `20.x`

See full deployment guide:
- `DEPLOYMENT.md`
