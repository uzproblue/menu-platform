import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** Same host as menu-server R2 public objects. Inlined at build — required for `cloudflare-image-loader.ts` (CDN `/cdn-cgi/image/` URLs and dev raw object URLs). */
const resolvedR2PublicBaseUrl =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
  process.env.R2_PUBLIC_BASE_URL?.trim() ||
  "";

const resolvedMenuUrl =
  process.env.NEXT_PUBLIC_MENU_URL?.trim() ||
  process.env.MENU_URL?.trim() ||
  "";

if (
  process.env.NODE_ENV === "production" &&
  !resolvedR2PublicBaseUrl
) {
  throw new Error(
    "menu-platform: R2_PUBLIC_BASE_URL or NEXT_PUBLIC_R2_PUBLIC_BASE_URL must be set when running `next build` (production). " +
      "Cloudflare Worker runtime vars alone are not available during the build; add the same value under Workers Builds → build environment variables (or CI env) so the image loader embeds your CDN origin. " +
      "Without it, object keys resolve as relative URLs on the app host (e.g. …/restaurants/menu-items/…).",
  );
}

const nextConfig: NextConfig = {
  ...(resolvedR2PublicBaseUrl || resolvedMenuUrl
    ? {
        env: {
          ...(resolvedR2PublicBaseUrl
            ? { NEXT_PUBLIC_R2_PUBLIC_BASE_URL: resolvedR2PublicBaseUrl }
            : {}),
          ...(resolvedMenuUrl ? { NEXT_PUBLIC_MENU_URL: resolvedMenuUrl } : {}),
        },
      }
    : {}),
  images: {
    loader: "custom",
    loaderFile: "./lib/cloudflare-image-loader.ts",
    /** Align with `FIXED_CDN_IMAGE_WIDTH` in cloudflare-image-loader (single CDN transform width). */
    deviceSizes: [1024],
    imageSizes: [1024],
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
