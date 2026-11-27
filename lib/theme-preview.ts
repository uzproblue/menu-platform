/**
 * HMAC theme preview tokens — keep algorithm in sync with
 * menu-customer/lib/theme/theme-preview.ts (same MENU_THEME_PREVIEW_SECRET).
 */
import {
  isGuestMenuThemeId,
  type GuestMenuThemeId,
} from "@/lib/guest-menu-theme";

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

type ThemePreviewPayload = {
  v: 1;
  lid: string;
  tid: string;
  exp: number;
};

function trimSecret(): string {
  return process.env.MENU_THEME_PREVIEW_SECRET?.trim() || "";
}

export function isThemePreviewSigningConfigured(): boolean {
  return trimSecret().length >= 16;
}

export function themePreviewTtlSeconds(): number {
  const raw = process.env.MENU_THEME_PREVIEW_TTL_SECONDS?.trim();
  if (!raw) return DEFAULT_TTL_SECONDS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 60) return DEFAULT_TTL_SECONDS;
  return Math.min(n, 30 * 24 * 60 * 60);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    utf8Bytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signPayload(body: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, utf8Bytes(body));
  return bytesToBase64Url(new Uint8Array(sig));
}

function encodePayload(payload: ThemePreviewPayload): string {
  return bytesToBase64Url(utf8Bytes(JSON.stringify(payload)));
}

export type SignThemePreviewInput = {
  locationId: string;
  themeId: GuestMenuThemeId;
  ttlSeconds?: number;
  nowMs?: number;
};

export async function signThemePreview(
  input: SignThemePreviewInput,
): Promise<{ token: string; expiresAt: number } | null> {
  const secret = trimSecret();
  if (secret.length < 16) return null;
  const locationId = input.locationId.trim();
  if (!locationId || !isGuestMenuThemeId(input.themeId)) return null;

  const ttl = input.ttlSeconds ?? themePreviewTtlSeconds();
  const now = input.nowMs ?? Date.now();
  const exp = Math.floor(now / 1000) + ttl;
  const payload: ThemePreviewPayload = {
    v: 1,
    lid: locationId,
    tid: input.themeId,
    exp,
  };
  const body = encodePayload(payload);
  const sig = await signPayload(body, secret);
  return { token: `${body}.${sig}`, expiresAt: exp };
}

/** Guest share URL that activates the preview cookie then opens the location. */
export function buildThemePreviewShareUrl(opts: {
  menuBaseUrl: string;
  locationId: string;
  token: string;
}): string {
  const base = opts.menuBaseUrl.trim().replace(/\/$/, "");
  const locationId = opts.locationId.trim();
  const url = new URL(`${base}/${locationId}`);
  url.searchParams.set("themePreview", opts.token);
  return url.toString();
}
