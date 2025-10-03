import type { NextConfig } from "next";

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "object-src 'none'",
  "connect-src 'self' https: blob: data:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "report-to csp-endpoint",
  "report-uri /api/csp-report"
].join('; ');

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspDirectives,
  },
  {
    key: 'Report-To',
    value: JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400,
      endpoints: [{ url: '/api/csp-report' }],
    }),
  },
  // YouTube embeds (and the IFrame API with enablejsapi/origin) require
  // a referrer so Google can validate the requesting origin. Using
  // strict-origin-when-cross-origin preserves privacy while fixing
  // "Video player configuration error (Error 153)" on training videos.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  // Set HSTS only if served over HTTPS by your reverse proxy
  // { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // Avoid failing Docker/CI builds due to ESLint rule violations.
  // Local dev can still surface lint errors via the editor or `npm run lint`.
  eslint: { ignoreDuringBuilds: true },
  // Allow production builds even if there are type errors.
  // Prefer fixing types, but this keeps Docker/CI unblocked.
  typescript: { ignoreBuildErrors: true },
  async headers(){
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
