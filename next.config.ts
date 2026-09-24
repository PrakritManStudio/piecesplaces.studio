import type { NextConfig } from "next";

import "./src/env";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["tunnel-prakrit-3000.patavee.space"],
  async redirects() {
    return [
      { source: "/login", destination: "/staff/login", permanent: false },
      { source: "/jobs", destination: "/staff/jobs", permanent: false },
      { source: "/jobs/:path*", destination: "/staff/jobs/:path*", permanent: false },
      { source: "/approvals", destination: "/staff/approvals", permanent: false },
      { source: "/payouts", destination: "/staff/payouts", permanent: false },
      { source: "/expenses", destination: "/staff/expenses", permanent: false },
      { source: "/dashboard", destination: "/staff/dashboard", permanent: false },
      { source: "/settings", destination: "/staff/settings", permanent: false },
    ];
  },
};

export default nextConfig;
