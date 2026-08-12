/**
 * Production entry point for GoDaddy / Node hosting.
 *
 * Must listen on 0.0.0.0 and process.env.PORT so the platform proxy can reach
 * the process. Do NOT use process.env.HOSTNAME — containers set that to the
 * machine name (e.g. ddec787a651a), which causes 503s when the proxy cannot
 * reach a localhost-only or hostname-only bind.
 *
 * /api/* is proxied at runtime via BACKEND_URL (not baked into the Next build).
 * Next.js rewrites alone read BACKEND_URL only at `next build` time, which is
 * why desktop clients with a stored token could hang on Loading forever after
 * deploy when the rewrite still pointed at 127.0.0.1:8000 inside the container.
 */
const http = require("http");
const https = require("https");
const { parse } = require("url");
const path = require("path");

function loadNext() {
  try {
    return require("next");
  } catch {
    // Root `npm install` may be incomplete; fall back to the frontend install.
    return require(path.join(__dirname, "frontend", "node_modules", "next"));
  }
}

const next = loadNext();

const port = Number(process.env.PORT) || 3000;
// Explicit bind host only — never process.env.HOSTNAME (OS/container hostname).
const host =
  process.env.HOST ||
  process.env.BIND_HOST ||
  process.env.LISTEN_ADDRESS ||
  "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

/** Runtime Django origin — bracket access so nothing is build-time inlined. */
function backendOrigin() {
  const raw = process.env["BACKEND_URL"] || "http://127.0.0.1:8000";
  return String(raw).replace(/\/$/, "");
}

const app = next({
  dev,
  dir: path.join(__dirname, "frontend"),
  hostname: host,
  port,
});
const handle = app.getRequestHandler();

function proxyApi(req, res) {
  const origin = backendOrigin();
  let dest;
  try {
    dest = new URL(req.url || "/api", origin);
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "Invalid BACKEND_URL." }));
    return;
  }

  const lib = dest.protocol === "https:" ? https : http;
  const headers = { ...req.headers, host: dest.host };
  delete headers["connection"];

  const proxyReq = lib.request(
    {
      protocol: dest.protocol,
      hostname: dest.hostname,
      port: dest.port || (dest.protocol === "https:" ? 443 : 80),
      path: `${dest.pathname}${dest.search}`,
      method: req.method,
      headers,
      timeout: 10_000,
    },
    (proxyRes) => {
      const outHeaders = { ...proxyRes.headers };
      delete outHeaders["transfer-encoding"];
      res.writeHead(proxyRes.statusCode || 502, outHeaders);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "API gateway timeout." }));
    }
  });

  proxyReq.on("error", (err) => {
    console.error(`[api-proxy] ${req.method} ${dest.href} -> ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          detail:
            "API unavailable. Set BACKEND_URL to your live Django origin (runtime env).",
        }),
      );
    }
  });

  req.pipe(proxyReq);
}

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      const parsedUrl = parse(req.url || "/", true);
      const pathname = parsedUrl.pathname || "/";

      // Lightweight deploy diagnostic (no secrets — host only).
      if (pathname === "/__backend") {
        let backendHost = "(invalid BACKEND_URL)";
        try {
          backendHost = new URL(backendOrigin()).host;
        } catch {
          /* keep default */
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            backendHost,
            backendUrlSet: Boolean(process.env["BACKEND_URL"]),
          }),
        );
        return;
      }

      if (pathname === "/api" || pathname.startsWith("/api/")) {
        proxyApi(req, res);
        return;
      }

      handle(req, res, parsedUrl);
    });

    server.listen(port, host, () => {
      const origin = backendOrigin();
      console.log(`> Ready on http://${host}:${port}`);
      console.log(`> API proxy -> ${origin}`);
      if (!process.env["BACKEND_URL"] && !dev) {
        console.warn(
          "> WARNING: BACKEND_URL is unset; /api proxies to 127.0.0.1:8000 (usually wrong on GoDaddy).",
        );
      }
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
