import path from "path";
import { fileURLToPath } from "url";

/** @type {import('next').NextConfig} */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  // Monorepo: keep file tracing rooted at the Next app (not the workspace root).
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: true },
  // API proxying is handled at runtime by:
  // - root `server.js` (GoDaddy / `npm start`) via BACKEND_URL
  // - `app/api/[...path]/route.ts` (next dev / next start)
  // Do NOT bake BACKEND_URL into rewrites here — that freezes 127.0.0.1 at build time.
};

export default nextConfig;
