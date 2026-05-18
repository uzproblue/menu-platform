import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MENU_PUBLIC_BASE_URL_DATA_ATTR } from "./location-menu-url";

export { MENU_PUBLIC_BASE_URL_DATA_ATTR };

function trimBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/$/, "") ?? "";
}

function readProcessMenuUrl(): string {
  return (
    trimBaseUrl(process.env.MENU_URL) ||
    trimBaseUrl(process.env.NEXT_PUBLIC_MENU_URL)
  );
}

/** Server: resolve configured menu-customer origin (empty if unset). */
export function resolveMenuPublicBaseUrl(): string {
  const fromProcess = readProcessMenuUrl();
  if (fromProcess.length > 0) return fromProcess;

  try {
    const { env } = getCloudflareContext();
    const fromBinding =
      trimBaseUrl(env.MENU_URL) || trimBaseUrl(env.NEXT_PUBLIC_MENU_URL);
    if (fromBinding.length > 0) return fromBinding;
  } catch {
    // Outside Cloudflare request context.
  }

  return "";
}
