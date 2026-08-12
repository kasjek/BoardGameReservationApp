# BoardGameReservationApp

Social table-booking app (Django API + Next.js web client).

## Local development

See `AGENTS.md` for backend (`uv`) and frontend (`pnpm`) workflows.

## Hosting / Node deploy (web client)

The repo root is deployable as a Node app (e.g. GoDaddy):

```bash
npm install
npm run build
npm start
```

- Root `server.js` listens on **`0.0.0.0`** and **`process.env.PORT`** (required for GoDaddy proxies)
- Optional override: `HOST` / `BIND_HOST` / `LISTEN_ADDRESS` — never use `HOSTNAME` (that is the container name)
- Set `BACKEND_URL` to the Django API origin (default `http://127.0.0.1:8000`)
- Do not upload `node_modules` or `frontend/.next` — the platform runs install/build
