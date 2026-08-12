/**
 * Production entry point for hosting platforms that require a root `main`
 * and `PORT` binding. Serves the Next.js app from `frontend/`.
 */
const { createServer } = require("http");
const { parse } = require("url");
const path = require("path");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

const app = next({
  dev,
  dir: path.join(__dirname, "frontend"),
  hostname,
  port,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
