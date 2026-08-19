/**
 * Single-process GoDaddy / Node entry: Next.js UI + embedded SQLite API.
 * No Django and no BACKEND_URL required.
 */
const http = require("http");
const { parse } = require("url");
const path = require("path");
const { handleApi } = require("./api/handler");

function loadNext() {
  try {
    return require("next");
  } catch {
    return require(path.join(__dirname, "frontend", "node_modules", "next"));
  }
}

const next = loadNext();
const port = Number(process.env.PORT) || 3000;
const host =
  process.env.HOST ||
  process.env.BIND_HOST ||
  process.env.LISTEN_ADDRESS ||
  "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

const app = next({
  dev,
  dir: path.join(__dirname, "frontend"),
  hostname: host,
  port,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      const parsedUrl = parse(req.url || "/", true);
      const pathname = parsedUrl.pathname || "/";
      if (pathname === "/api" || pathname.startsWith("/api/")) {
        handleApi(req, res);
        return;
      }
      handle(req, res, parsedUrl);
    });
    server.listen(port, host, () => {
      console.log(`> Ready on http://${host}:${port}`);
      console.log("> API: embedded SQLite (no BACKEND_URL)");
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
