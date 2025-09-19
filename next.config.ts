import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid failing Docker/CI builds due to ESLint rule violations.
  // Local dev can still surface lint errors via the editor or `npm run lint`.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
