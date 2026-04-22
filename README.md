# BGWATSAPP

[Launch BGWATSAPP (One-Click)](https://stackblitz.com/github/georgebenedict77/bgwatsapp?startScript=start)

BGWATSAPP is a full-stack WhatsApp-style chat web app with:
- phone + OTP login
- direct and group chats
- contacts directory + chat management
- black/gold/red interactive theme

If you are viewing this on GitHub, click the link above and it launches instantly in your browser.

## Launch from GitHub (important)

You cannot run this app directly inside GitHub pages because it needs a Node.js backend (`server.js` + `/api/*` routes).

Use one of these:
- run locally on your machine
- deploy to a Node host (Render/Railway/etc.)

## Run locally from GitHub

```bash
git clone https://github.com/georgebenedict77/bgwatsapp.git
cd bgwatsapp
npm install
npm start
```

Open: `http://localhost:3000`

If port `3000` is busy:

```bash
# PowerShell
$env:PORT=3900
npm start
```

Open: `http://localhost:3900`

## Deploy for a public live link (Render quick path)

1. Create a new **Web Service** on Render and connect this repo.
2. Runtime: `Node`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables:
   - `OTP_SMS_PROVIDER=mimic` (or `twilio` for real SMS)
   - `OTP_ALLOW_DEV_CODE=true` (for mimic/demo mode)
   - `APP_PUBLIC_URL=https://your-render-url.onrender.com`
6. Deploy and open your Render URL.

## Live link block in app

The login screen now includes a **Live Website** block with:
- direct app URL
- copy button
- open button

To show your public production URL in that block, set:

```env
APP_PUBLIC_URL=https://your-live-domain.com
```

## OTP setup

Copy `.env.example` to `.env` and choose one mode:

- `OTP_SMS_PROVIDER=mimic` for local/demo OTP (shows demo code in UI)
- `OTP_SMS_PROVIDER=twilio` for real SMS with Twilio credentials
