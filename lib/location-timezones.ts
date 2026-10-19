/** Curated IANA zones for location settings (Uzbekistan-first). */
export const LOCATION_TIMEZONE_OPTIONS = [
  "Asia/Tashkent",
  "Asia/Samarkand",
  "Asia/Almaty",
  "Asia/Bishkek",
  "Asia/Dushanbe",
  "Asia/Ashgabat",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Dubai",
  "UTC",
] as const;

export const DEFAULT_LOCATION_TIMEZONE = "Asia/Tashkent";

export type LocationTimezoneOption = (typeof LOCATION_TIMEZONE_OPTIONS)[number];

export function resolveWizardTimezone(raw: string | null | undefined): string {
  const tz = raw?.trim();
  if (!tz) return DEFAULT_LOCATION_TIMEZONE;
  return tz;
}
