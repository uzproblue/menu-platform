/**
 * Server-side calls to menu-server: prefer Cloudflare `MENU_SERVER` service binding,
 * else `AUTH_API_BASE_URL` for local HTTP (e.g. plain `next dev`).
 */
export * from "./types";
export * from "./client";
export * from "./auth";
export * from "./teammates";
export * from "./catalog-read";
export * from "./catalog-categories";
export * from "./catalog-menu-items";
export * from "./locations-core";
export * from "./location-menu";
export * from "./seasonal-menus";
