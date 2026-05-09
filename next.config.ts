import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { buildImageRemotePatterns } from "./lib/next-image-remote-patterns";

/** Same host as menu-server R2 public objects. Inlined at build — if CI only sets `R2_PUBLIC_BASE_URL`, forward it so the client bundle still matches remote `src` URLs and other client reads. Only set when non-empty: pinning `""` can override dotenv and confuse client env inlining. */
const resolvedR2PublicBaseUrl =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
  process.env.R2_PUBLIC_BASE_URL?.trim() ||
  "";

const nextConfig: NextConfig = {
  ...(resolvedR2PublicBaseUrl
    ? { env: { NEXT_PUBLIC_R2_PUBLIC_BASE_URL: resolvedR2PublicBaseUrl } }
    : {}),
  images: {
    // Default loader → `/_next/image`. On Cloudflare Workers, OpenNext uses `env.IMAGES` (see wrangler.jsonc).
    remotePatterns: buildImageRemotePatterns(),
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
