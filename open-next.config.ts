import {
  defineCloudflareConfig,
  type OpenNextConfig,
} from "@opennextjs/cloudflare";

// OpenNext invokes the package `build` script to compile Next.js. This project
// uses `build` = `opennextjs-cloudflare build`, so the inner step must be plain
// `next build` to avoid infinite recursion.
//
// Next.js 16 defaults to Turbopack for `next build`; OpenNext production builds
// use webpack here for predictable `next/image` + remotePatterns behavior with the adapter.
const config: OpenNextConfig = {
  ...defineCloudflareConfig(),
  buildCommand: "npx next build --webpack",
};

export default config;
