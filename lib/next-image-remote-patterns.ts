import type { RemotePattern } from "next/dist/shared/lib/image-config";

function pushPatternForAbsoluteUrl(patterns: RemotePattern[], raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  try {
    const u = new URL(trimmed);
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

/** Comma-separated origins (no path), e.g. `https://cdn.example.com,https://other.example.com`. */
function addPatternsFromCommaSeparatedOrigins(
  patterns: RemotePattern[],
  value: string | undefined,
): void {
  if (!value?.trim()) return;
  for (const part of value.split(",")) {
    pushPatternForAbsoluteUrl(patterns, part);
  }
}

/**
 * Hosts allowed for `next/image` `src` when using remote URLs (e.g. R2 public URLs).
 *
 * **Build time:** OpenNext bakes these into the Worker. Cloudflare deploy builds must pass the same
 * vars used locally (`R2_PUBLIC_BASE_URL`, etc.); runtime-only Worker vars do not change this list.
 *
 * Sources: `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`, `R2_PUBLIC_BASE_URL`,
 * `NEXT_PUBLIC_IMAGE_SOURCE_HOSTS` (comma-separated hostnames, https),
 * `LOCATION_EXPORT_PURGE_EXTRA_BASES` (comma-separated origins — same shape as purge; covers CDN
 * hostnames that differ from `R2_PUBLIC_BASE_URL`), plus default `*.r2.dev` / `*.r2.cloudflarestorage.com`.
 */
export function buildImageRemotePatterns(): RemotePattern[] {
  const patterns: RemotePattern[] = [];
  const extraHosts = (process.env.NEXT_PUBLIC_IMAGE_SOURCE_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const hostname of extraHosts) {
    patterns.push({ protocol: "https", hostname, pathname: "/**" });
  }
  const bases = [
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL,
    process.env.R2_PUBLIC_BASE_URL,
  ];
  for (const raw of bases) {
    if (!raw?.trim()) continue;
    pushPatternForAbsoluteUrl(patterns, raw);
  }
  addPatternsFromCommaSeparatedOrigins(
    patterns,
    process.env.LOCATION_EXPORT_PURGE_EXTRA_BASES,
  );
  patterns.push({ protocol: "https", hostname: "*.r2.dev", pathname: "/**" });
  patterns.push({
    protocol: "https",
    hostname: "*.r2.cloudflarestorage.com",
    pathname: "/**",
  });
  return patterns;
}
