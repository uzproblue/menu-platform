/**
 * Registered guest menu theme pack ids.
 * Keep in sync with menu-customer `GUEST_MENU_THEME_IDS` and menu-server allowlist.
 */
export const GUEST_MENU_THEME_IDS = ["default"] as const;

export type GuestMenuThemeId = (typeof GUEST_MENU_THEME_IDS)[number];

export const DEFAULT_GUEST_MENU_THEME_ID: GuestMenuThemeId = "default";

export const GUEST_MENU_THEME_OPTIONS: ReadonlyArray<{
  id: GuestMenuThemeId;
  labelKey: string;
}> = [{ id: "default", labelKey: "settings.guestMenuThemeDefault" }];

export function isGuestMenuThemeId(value: string | null | undefined): value is GuestMenuThemeId {
  if (!value) return false;
  return (GUEST_MENU_THEME_IDS as readonly string[]).includes(value);
}

export function normalizeGuestMenuThemeId(
  value: string | null | undefined,
): GuestMenuThemeId {
  const trimmed = value?.trim() ?? "";
  return isGuestMenuThemeId(trimmed) ? trimmed : DEFAULT_GUEST_MENU_THEME_ID;
}
