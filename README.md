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

## OTP setup

Copy `.env.example` to `.env` and choose one mode:

- `OTP_SMS_PROVIDER=mimic` for local/demo OTP (shows demo code in UI)
- `OTP_SMS_PROVIDER=twilio` for real SMS with Twilio credentials

