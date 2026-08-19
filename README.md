# Too Many Games

Single Node.js app (Next.js UI + embedded SQLite API) for GoDaddy Node Hosting.

## GoDaddy deploy

```bash
npm install
npm run build
npm start
```

- Start command: `npm start` (or `NODE_ENV=production node server.js`)
- No `BACKEND_URL` / Django required
- SQLite DB is created automatically under `data/app.sqlite3` on first start
- **For board-game cover images:** set `BGG_API_TOKEN` (BoardGameGeek application Bearer token). Without it, covers fall back to Geekdo/Wikipedia when possible.
- **For Google sign-in:** set `GOOGLE_CLIENT_ID` (Google Cloud Console → Credentials → OAuth 2.0 Client ID, web application). Add this site (and `http://localhost:3000` for local) under Authorized JavaScript origins. If unset, the Google button is hidden.

## Local

```bash
npm install
npm run build   # optional for prod-like
npm run dev     # http://0.0.0.0:3000
```
