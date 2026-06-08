import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { PlatformEvent } from "./events";

const MAX_METADATA_BYTES = 4096;
const NONE_RESTAURANT = "none";

export type AnalyticsSource = "server" | "client";

export type RecordStaffEventInput = {
  event: PlatformEvent;
  userId: string;
  restaurantId?: string | null;
  role?: string | null;
  source: AnalyticsSource;
  metadata?: Record<string, unknown> | null;
};

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata || Object.keys(metadata).length === 0) return "{}";
  try {
    let json = JSON.stringify(metadata);
    if (json.length > MAX_METADATA_BYTES) {
      json = json.slice(0, MAX_METADATA_BYTES);
    }
    return json;
  } catch {
    return "{}";
  }
}

function writeDataPoint(input: RecordStaffEventInput): void {
  try {
    const { env } = getCloudflareContext();
    const dataset = env.PLATFORM_ANALYTICS;
    if (!dataset?.writeDataPoint) return;

    const restaurantId = input.restaurantId?.trim() || NONE_RESTAURANT;

    dataset.writeDataPoint({
      indexes: [restaurantId],
      blobs: [
        input.event,
        input.userId,
        restaurantId,
        input.role?.trim() || "",
        input.source,
        serializeMetadata(input.metadata),
      ],
      doubles: [1],
    });
  } catch {
    /* plain next dev or missing Workers context */
  }
}

/**
 * Record a staff platform event to Workers Analytics Engine.
 * Non-blocking; never throws.
 */
export function recordStaffEvent(input: RecordStaffEventInput): void {
  try {
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(Promise.resolve().then(() => writeDataPoint(input)));
  } catch {
    writeDataPoint(input);
  }
}
