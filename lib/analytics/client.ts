"use client";

import type { PlatformEvent } from "./events";
import { CLIENT_EVENTS } from "./events";

const EVENTS_URL = "/api/analytics/events";

/**
 * Fire-and-forget client event beacon for UI-only staff actions.
 * Identity is enriched server-side; only event name + optional metadata are sent.
 */
export function trackClientEvent(
  event: PlatformEvent,
  metadata?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!CLIENT_EVENTS.has(event)) return;

  const body = JSON.stringify({ event, metadata: metadata ?? {} });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(EVENTS_URL, blob)) return;
  }

  void fetch(EVENTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* analytics must not surface errors to UI */
  });
}
