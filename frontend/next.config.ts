import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const isStaticExport = process.env.STATIC_EXPORT === "true";
const appVersion = readFileSync(resolve(process.cwd(), "..", "VERSION"), "utf8").trim();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  output: isStaticExport ? "export" : undefined,
  trailingSlash: isStaticExport,
  compiler: {
    styledComponents: true,
  },
  ...(isStaticExport
    ? {}
    : {
        async rewrites() {
          return [
            { source: "/api/:path*", destination: "http://localhost:5000/api/:path*" },
          ];
        },
      }),
};

export default nextConfig;
