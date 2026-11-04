import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

// apps/web is its own npm package inside the repo. The repo root has a second
// lockfile (the harness), so pin the app root explicitly instead of letting
// Next.js guess it.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  // Self-contained server in .next/standalone for the Docker image (DEPLOY-001, apps/web/Dockerfile).
  output: "standalone",
  turbopack: { root: appRoot },
  // Do not tell visitors which framework serves the site (SEC-003).
  poweredByHeader: false,
  // Security headers on every response (lib/security-headers.ts).
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
