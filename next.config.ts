import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { buildImageRemotePatterns } from "./lib/next-image-remote-patterns";

const nextConfig: NextConfig = {
  images: {
    // Zone Image Resizing via `/cdn-cgi/image/` — see `image-loader.ts` (dev uses original `src`).
    loader: "custom",
    loaderFile: "./image-loader.ts",
    remotePatterns: buildImageRemotePatterns(),
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
