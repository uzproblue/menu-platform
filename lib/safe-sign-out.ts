"use client";

import { signOut } from "next-auth/react";

/**
 * Sign out via the current origin, then navigate to `callbackPath`.
 * Avoids `window.location = …` to a wrong host when `NEXTAUTH_URL` / server origin is misconfigured.
 */
export async function safeSignOut(callbackPath = "/login"): Promise<void> {
  const normalized = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  const data = (await signOut({
    redirect: false,
    callbackUrl: `${window.location.origin}${normalized}`,
  })) as { url?: string } | undefined;

  const fallback = `${window.location.origin}${normalized}`;
  if (data?.url) {
    try {
      const u = new URL(data.url);
      if (u.origin === window.location.origin) {
        window.location.assign(data.url);
        return;
      }
    } catch {
      /* ignore */
    }
  }
  window.location.assign(fallback);
}
