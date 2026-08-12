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
- **Required in production:** set `BACKEND_URL` to the live Django API origin (e.g. `https://api.example.com`). This is read at **runtime** by `server.js` (and the Next `/api` route) — not only at build time. If unset, `/api` proxies to `http://127.0.0.1:8000` inside the Node container and the app stays on Loading / cannot log in.
- After deploy, open `/__backend` on the site — `backendUrlSet` should be `true` and `backendHost` should be your Django host (not `127.0.0.1:8000`)
- Start log should show `Ready on http://0.0.0.0:<PORT>` and `API proxy -> <your Django origin>`
- Do not upload `node_modules` or `frontend/.next` — the platform runs install/build
