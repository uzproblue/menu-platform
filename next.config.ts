import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { buildImageRemotePatterns } from "./lib/next-image-remote-patterns";

/** Same host as menu-server R2 public objects; required by `image-loader.ts` to rewrite absolute R2 URLs to `/cdn-cgi/image/...` on that zone. Inlined at build — if CI only sets `R2_PUBLIC_BASE_URL`, forward it so the client bundle still matches `src` URLs. Only set when non-empty: pinning `""` can override dotenv and confuse client env inlining. */
const resolvedR2PublicBaseUrl =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
  process.env.R2_PUBLIC_BASE_URL?.trim() ||
  "";

const nextConfig: NextConfig = {
  ...(resolvedR2PublicBaseUrl
    ? { env: { NEXT_PUBLIC_R2_PUBLIC_BASE_URL: resolvedR2PublicBaseUrl } }
    : {}),
  images: {
    // Zone Image Resizing via `/cdn-cgi/image/` — see `image-loader.ts` (dev uses original `src`).
    loader: "custom",
    loaderFile: "./image-loader.ts",
    remotePatterns: buildImageRemotePatterns(),
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
