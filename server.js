/**
 * Production entry point for GoDaddy / Node hosting.
 *
 * Must listen on 0.0.0.0 and process.env.PORT so the platform proxy can reach
 * the process. Do NOT use process.env.HOSTNAME — containers set that to the
 * machine name (e.g. ddec787a651a), which causes 503s when the proxy cannot
 * reach a localhost-only or hostname-only bind.
 */
const { createServer } = require("http");
const { parse } = require("url");
const path = require("path");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
// Explicit bind host only — never process.env.HOSTNAME (OS/container hostname).
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
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });
    server.listen(port, host, () => {
      console.log(`> Ready on http://${host}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
