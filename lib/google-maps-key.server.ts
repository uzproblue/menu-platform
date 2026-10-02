import { getCloudflareContext } from "@opennextjs/cloudflare";

function trimKey(val?: string | null): string {
  return val?.trim() ?? "";
}

/**
 * Server-side resolution of the Google Maps API key.
 * Checks:
 * 1. process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * 2. process.env.GOOGLE_MAPS_API_KEY
 * 3. Cloudflare Worker runtime env: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * 4. Cloudflare Worker runtime env: env.GOOGLE_MAPS_API_KEY
 */
export function resolveGoogleMapsApiKey(): string {
  const fromProcess =
    trimKey(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) ||
    trimKey(process.env.GOOGLE_MAPS_API_KEY);
  if (fromProcess) return fromProcess;

  try {
    const { env } = getCloudflareContext();
    const cfEnv = env as unknown as Record<string, string | undefined>;
    const fromBinding =
      trimKey(cfEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) ||
      trimKey(cfEnv.GOOGLE_MAPS_API_KEY);
    if (fromBinding) return fromBinding;
  } catch {
    // Outside Cloudflare request context.
  }

  return "";
}
