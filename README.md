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
- **Facebook Login:** set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`. The button is hidden until both are set. In Meta for Developers, add this site’s origin as an app domain / Website URL and request the `email` permission.

## Local

```bash
npm install
npm run build   # optional for prod-like
npm run dev     # http://0.0.0.0:3000
```
