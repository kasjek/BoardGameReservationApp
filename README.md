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
- Optional: `BGG_API_TOKEN` (BoardGameGeek) for richer live game search/covers

## Local

```bash
npm install
npm run build   # optional for prod-like
npm run dev     # http://0.0.0.0:3000
```
