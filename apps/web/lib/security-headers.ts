/**
 * The security headers every website response carries (SEC-003), used by next.config.ts.
 * A function of NODE_ENV so the unit test can check development and production.
 */

export type Header = { key: string; value: string };

/** HSTS starts at one day: a wrong HSTS on a domain is hard to undo. DEPLOY-001 says when to raise it. */
export const HSTS_MAX_AGE_SECONDS = 86_400;

/** FastAPI's documentation paths, as the browser sees them through the /api proxy. */
export const HIDDEN_API_PATHS = [
  "/api/docs",
  "/api/redoc",
  "/api/openapi.json",
];

export function contentSecurityPolicy(nodeEnv: string | undefined): string {
  const development = nodeEnv !== "production";
  return [
    "default-src 'self'",
    // 'unsafe-inline': Next's hydration scripts and next-themes' theme script are inline;
    // 'unsafe-eval' only in development, for React refresh.
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    // Recharts and a few components set inline styles.
    "style-src 'self' 'unsafe-inline'",
    // data: and blob: for the uploaded scan preview and the Grad-CAM overlay.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): Header[] {
  const headers: Header[] = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(nodeEnv) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];
  // Production only: browsers ignore HSTS on http://localhost anyway.
  if (nodeEnv === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: `max-age=${HSTS_MAX_AGE_SECONDS}`,
    });
  }
  return headers;
}
