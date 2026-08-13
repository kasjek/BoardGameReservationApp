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
- **Required for login/register:** set `BACKEND_URL` in the GoDaddy Node env to your **live Django API origin** (example: `https://your-django-host.example.com`). `server.js` proxies `/api/*` to that origin at runtime. If unset, the app cannot reach Django and login/register fail.
- After deploy, open `/__backend` on the site — `backendUrlSet` must be `true` and `backendHost` must not be `127.0.0.1:8000`
- Start log should show `Ready on http://0.0.0.0:<PORT>` and `API proxy -> <your Django origin>`
- Do not upload `node_modules` or `frontend/.next` — the platform runs install/build
- This ZIP is the **web client only** (Django/`backend/` is not included). Host the API separately and point `BACKEND_URL` at it.
