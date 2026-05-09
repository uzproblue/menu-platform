import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** Same host as menu-server R2 public objects. Inlined at build — required for `cloudflare-image-loader.ts` (CDN `/cdn-cgi/image/` URLs and dev raw object URLs). */
const resolvedR2PublicBaseUrl =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
  process.env.R2_PUBLIC_BASE_URL?.trim() ||
  "";

const nextConfig: NextConfig = {
  ...(resolvedR2PublicBaseUrl
    ? { env: { NEXT_PUBLIC_R2_PUBLIC_BASE_URL: resolvedR2PublicBaseUrl } }
    : {}),
  images: {
    loader: "custom",
    loaderFile: "./lib/cloudflare-image-loader.ts",
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
