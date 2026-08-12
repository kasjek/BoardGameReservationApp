import path from "path";
import { fileURLToPath } from "url";

/** @type {import('next').NextConfig} */
const API_TARGET = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  // Monorepo: keep file tracing rooted at the Next app (not the workspace root).
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    // Proxy API calls to the Django backend (same-origin in the browser -> no CORS).
    return [{ source: "/api/:path*", destination: `${API_TARGET}/api/:path*` }];
  },
};

export default nextConfig;
