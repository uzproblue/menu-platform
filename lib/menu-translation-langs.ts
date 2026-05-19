/**
 * Guest-visible languages configurable per location (subset).
 * Keep in sync with menu-server/src/lib/menu-translation-langs.ts.
 */
export const LOCATION_TRANSLATION_OPTIONS = [
  "UZ",
  "KZ",
  "RU",
  "EN",
  "KG",
] as const;

/** Default selection for new locations / fallback when API returns none (subset of allowed codes). */
export const DEFAULT_LOCATION_TRANSLATION_SELECTION = [
  "EN",
  "RU",
  "UZ",
] as const;

const ALLOWED = new Set<string>(LOCATION_TRANSLATION_OPTIONS);

/**
 * Validates platform-submitted translation lang arrays before forwarding to menu-server.
 */
export function validateTranslationLangsInput(
  codes: string[],
): { ok: true; value: string[] } | { ok: false; message: string } {
  const normalized = codes
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^[A-Z0-9_-]{2,8}$/.test(x));
  const unknown = [...new Set(normalized.filter((x) => !ALLOWED.has(x)))];
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `unknown language codes: ${unknown.join(", ")}. Allowed: ${LOCATION_TRANSLATION_OPTIONS.join(", ")}`,
    };
  }
  const unique = [...new Set(normalized)];
  if (unique.length === 0) {
    return {
      ok: false,
      message:
        "translationLangs must contain at least one allowed language code",
    };
  }
  return { ok: true, value: unique };
}
