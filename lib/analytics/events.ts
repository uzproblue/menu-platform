/**
 * Staff platform analytics event catalog.
 * Dot-notation names; must stay in sync with CLIENT_EVENTS allowlist for browser beacons.
 */
export const PlatformEvent = {
  // Navigation & context
  PLATFORM_PAGE_VIEWED: "platform.page_viewed",
  RESTAURANT_CONTEXT_SWITCHED: "restaurant.context_switched",
  LOCALE_CHANGED: "locale.changed",

  // Locations
  LOCATION_CREATED: "location.created",
  LOCATION_UPDATED: "location.updated",
  LOCATION_DELETED: "location.deleted",
  LOCATION_ACTIVATED: "location.activated",
  LOCATION_DEACTIVATED: "location.deactivated",
  LOCATION_CATEGORIES_ASSIGNED: "location.categories_assigned",
  LOCATION_SECTIONS_ASSIGNED: "location.sections_assigned",
  LOCATION_MENU_PUBLISHED: "location.menu_published",
  LOCATION_MENU_ITEMS_BULK_UPDATED: "location.menu_items_bulk_updated",
  LOCATION_MENU_ITEM_TOGGLED: "location.menu_item_toggled",
  LOCATION_QR_DOWNLOADED: "location.qr_downloaded",
  LOCATION_QR_LINK_COPIED: "location.qr_link_copied",

  // Catalog — items
  CATALOG_MENU_ITEM_CREATED: "catalog.menu_item_created",
  CATALOG_MENU_ITEM_UPDATED: "catalog.menu_item_updated",
  CATALOG_MENU_ITEM_DELETED: "catalog.menu_item_deleted",
  CATALOG_MENU_ITEM_ACTIVATED: "catalog.menu_item_activated",
  CATALOG_MENU_ITEM_DEACTIVATED: "catalog.menu_item_deactivated",
  CATALOG_MENU_ITEM_TRANSLATIONS_UPDATED: "catalog.menu_item_translations_updated",

  // Catalog — categories
  CATALOG_CATEGORY_CREATED: "catalog.category_created",
  CATALOG_CATEGORY_UPDATED: "catalog.category_updated",
  CATALOG_CATEGORY_DELETED: "catalog.category_deleted",
  CATALOG_CATEGORY_TRANSLATIONS_UPDATED: "catalog.category_translations_updated",

  // Catalog — menu sections
  CATALOG_MENU_SECTION_CREATED: "catalog.menu_section_created",
  CATALOG_MENU_SECTION_UPDATED: "catalog.menu_section_updated",
  CATALOG_MENU_SECTION_DELETED: "catalog.menu_section_deleted",
  CATALOG_MENU_SECTIONS_REORDERED: "catalog.menu_sections_reordered",

  // Videos
  VIDEO_UPLOAD_SESSION_STARTED: "video.upload_session_started",
  VIDEO_LINKED_TO_ITEM: "video.linked_to_item",
  VIDEO_REMOVED_FROM_ITEM: "video.removed_from_item",

  // Seasonal
  SEASONAL_DESIGN_CREATED: "seasonal.design_created",
  SEASONAL_DESIGN_DELETED: "seasonal.design_deleted",
  SEASONAL_DESIGN_METADATA_SAVED: "seasonal.design_metadata_saved",
  SEASONAL_DOCUMENT_SAVED: "seasonal.document_saved",
  SEASONAL_PDF_EXPORTED: "seasonal.pdf_exported",

  // Loyalty
  LOYALTY_POINTS_EARNED: "loyalty.points_earned",
  LOYALTY_POINTS_REDEEMED: "loyalty.points_redeemed",
  LOYALTY_POINTS_ADJUSTED: "loyalty.points_adjusted",
  LOYALTY_PROMOTION_CREATED: "loyalty.promotion_created",
  LOYALTY_PROMOTION_UPDATED: "loyalty.promotion_updated",
  LOYALTY_PROMOTION_DELETED: "loyalty.promotion_deleted",

  // Team & account
  ACCOUNT_NAME_UPDATED: "account.name_updated",
  ACCOUNT_PASSWORD_CHANGED: "account.password_changed",
  TEAM_TEAMMATE_INVITED: "team.teammate_invited",
  TEAM_TEAMMATE_REMOVED: "team.teammate_removed",
  TEAM_TEMPORARY_PASSWORD_REVEALED: "team.temporary_password_revealed",

  // Media
  MEDIA_R2_UPLOADED: "media.r2_uploaded",

  // Pipeline side-effects
  PIPELINE_CATALOG_CHANGE_SCHEDULED: "pipeline.catalog_change_scheduled",
  PIPELINE_LOCATION_EXPORT_SCHEDULED: "pipeline.location_export_scheduled",
  PIPELINE_ALL_LOCATIONS_EXPORT_SCHEDULED: "pipeline.all_locations_export_scheduled",
} as const;

export type PlatformEvent = (typeof PlatformEvent)[keyof typeof PlatformEvent];

/** Events allowed from browser beacons (UI-only actions). */
export const CLIENT_EVENTS = new Set<PlatformEvent>([
  PlatformEvent.PLATFORM_PAGE_VIEWED,
  PlatformEvent.LOCALE_CHANGED,
  PlatformEvent.LOCATION_QR_DOWNLOADED,
  PlatformEvent.LOCATION_QR_LINK_COPIED,
  PlatformEvent.SEASONAL_PDF_EXPORTED,
]);

export function isClientEvent(event: string): event is PlatformEvent {
  return CLIENT_EVENTS.has(event as PlatformEvent);
}

export function isPlatformEvent(event: string): event is PlatformEvent {
  return Object.values(PlatformEvent).includes(event as PlatformEvent);
}
