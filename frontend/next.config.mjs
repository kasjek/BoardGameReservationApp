import path from "path";
import { fileURLToPath } from "url";

/** @type {import('next').NextConfig} */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: true },
  // API is served by root server.js (embedded SQLite). No Django proxy / BACKEND_URL.
};

export default nextConfig;
