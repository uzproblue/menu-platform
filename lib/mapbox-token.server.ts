import { getCloudflareContext } from "@opennextjs/cloudflare";

function trimToken(val?: string | null): string {
  return val?.trim() ?? "";
}

/**
 * Server-side resolution of Mapbox public token.
 * Checks:
 * 1. process.env.NEXT_PUBLIC_MAPBOX_TOKEN
 * 2. process.env.MAPBOX_TOKEN
 * 3. Cloudflare Worker runtime env: env.NEXT_PUBLIC_MAPBOX_TOKEN
 * 4. Cloudflare Worker runtime env: env.MAPBOX_TOKEN
 */
export function resolveMapboxToken(): string {
  const fromProcess =
    trimToken(process.env.NEXT_PUBLIC_MAPBOX_TOKEN) ||
    trimToken(process.env.MAPBOX_TOKEN);
  if (fromProcess) return fromProcess;

  try {
    const { env } = getCloudflareContext();
    const cfEnv = env as unknown as Record<string, string | undefined>;
    const fromBinding =
      trimToken(cfEnv.NEXT_PUBLIC_MAPBOX_TOKEN) ||
      trimToken(cfEnv.MAPBOX_TOKEN);
    if (fromBinding) return fromBinding;
  } catch {
    // Outside Cloudflare request context.
  }

  return "";
}
