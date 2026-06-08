/** Client-safe analytics exports only. Server code: `@/lib/analytics/server`. */
export { PlatformEvent, CLIENT_EVENTS, isClientEvent, isPlatformEvent } from "./events";
export type { PlatformEvent as PlatformEventName } from "./events";
export { trackClientEvent } from "./client";
