import {
  defineCloudflareConfig,
  type OpenNextConfig,
} from "@opennextjs/cloudflare";

// OpenNext invokes the package `build` script to compile Next.js. This project
// uses `build` = `opennextjs-cloudflare build`, so the inner step must be plain
// `next build` to avoid infinite recursion.
const config: OpenNextConfig = {
  ...defineCloudflareConfig(),
  buildCommand: "npx next build",
};

export default config;
