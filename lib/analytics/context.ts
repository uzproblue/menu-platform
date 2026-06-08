import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import type { PlatformEvent } from "./events";
import { recordStaffEvent } from "./write";

export type StaffAnalyticsContext = {
  userId: string;
  restaurantId: string | null;
  role: string | null;
};

/**
 * Resolve authenticated staff identity for analytics enrichment.
 * Returns null when session is missing or expired.
 */
export async function getStaffAnalyticsContext(): Promise<StaffAnalyticsContext | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  return {
    userId,
    restaurantId: restaurantId ?? null,
    role: null,
  };
}

/** Record a server-side staff mutation event using session context. */
export async function trackStaffMutation(
  event: PlatformEvent,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const ctx = await getStaffAnalyticsContext();
  if (!ctx) return;

  recordStaffEvent({
    event,
    userId: ctx.userId,
    restaurantId: ctx.restaurantId,
    role: ctx.role,
    source: "server",
    metadata,
  });
}
