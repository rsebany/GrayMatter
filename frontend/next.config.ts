import path from "node:path";
import type { NextConfig } from "next";

/** One copy of three for the app and @iwer/devui (avoids material.onBuild mismatch). */
const threePackageRoot = path.join(process.cwd(), "node_modules", "three");

const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  // Large multipart bodies for DICOM (ZIP / folder) proxied through `/api/*` → FastAPI.
  // Default is 10MB; `proxyClientMaxBodySize` avoids truncated uploads when using Next’s proxy.
  // `proxyTimeout`: MRI inference can exceed the default ~30s proxy limit (socket hang up).
  experimental: {
    proxyClientMaxBodySize: "1gb",
    proxyTimeout: 600_000, // 10 minutes when using NEXT_PUBLIC_API_BASE_URL=/api
  },
  // Hide Next.js dev "N" build indicator (options not in current NextConfig types but supported at runtime)
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  } as NextConfig["devIndicators"],
  async redirects() {
    return [
      { source: "/upload", destination: "/upload-dicom", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/webxr/patient/:id", destination: "/xr/patient/:id" },
        // Canonical public URL `/webxr` → AR WebXR lab (query string preserved).
        { source: "/webxr", destination: "/xr/ar" },
        // Single-tunnel mode: frontend stays public; Next proxies API to local backend.
        { source: "/api/:path*", destination: `${backendInternalUrl}/:path*` },
      ],
    };
  },
  webpack(config) {
    const alias = config.resolve.alias;
    const rest =
      alias && typeof alias === "object" && !Array.isArray(alias)
        ? (alias as Record<string, string | string[] | false>)
        : {};
    config.resolve.alias = {
      ...rest,
      three: threePackageRoot,
    };
    return config;
  },
};

export default nextConfig;
