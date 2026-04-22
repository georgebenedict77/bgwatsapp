# BGWATSAPP

BGWATSAPP is a full-stack WhatsApp-style chat web app with:
- phone + OTP login
- direct and group chats
- contacts directory + chat management
- black/gold/red interactive theme

## Run locally

```bash
npm install
npm start
```

Open: `http://localhost:3000`

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
