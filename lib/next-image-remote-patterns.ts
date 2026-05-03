import type { RemotePattern } from "next/dist/shared/lib/image-config";

/**
 * Hosts allowed for `next/image` `src` when using remote URLs (e.g. R2 public URLs).
 * Extend via `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` or `R2_PUBLIC_BASE_URL` at build time.
 */
export function buildImageRemotePatterns(): RemotePattern[] {
  const patterns: RemotePattern[] = [];
  const bases = [
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL,
    process.env.R2_PUBLIC_BASE_URL,
  ];
  for (const raw of bases) {
    if (!raw?.trim()) continue;
    try {
      const u = new URL(raw.trim());
      const protocol = u.protocol === "http:" ? "http" : "https";
      patterns.push({
        protocol,
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
        pathname: "/**",
      });
    } catch {
      /* ignore invalid URL */
    }
  }
  patterns.push({ protocol: "https", hostname: "*.r2.dev", pathname: "/**" });
  patterns.push({
    protocol: "https",
    hostname: "*.r2.cloudflarestorage.com",
    pathname: "/**",
  });
  return patterns;
}
