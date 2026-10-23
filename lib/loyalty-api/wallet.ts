import { loyaltyApiJson, loyaltyApiVoid } from "./client";
import type { LoyaltySegmentKey } from "./types";

export type WalletPassLocation = {
  locationId: string;
  latitude: number;
  longitude: number;
  relevantText?: string;
};

export type WalletPassField = {
  label?: string;
  value: string;
};

export type WalletFeaturedAction = {
  identifier: string;
  type: string;
  /** HTTPS URL, or `tel:` for `call`. Optional Google Maps link for `place`. */
  url?: string;
  /** Apple Maps Place ID. Required for `place`. */
  placeIdentifier?: string;
};

export type WalletFeaturedActionSlot = {
  identifier: string;
  type: string;
};

export type WalletPassSystemTemplate = {
  id: string;
  description: string;
  programTitle: string;
  pointsLabel: string;
  memberNameLabel: string;
  primaryFields: WalletPassField[];
  secondaryFields: WalletPassField[];
  headerFields: WalletPassField[];
  footerFields: WalletPassField[];
  backFields: WalletPassField[];
  featuredActionSlots: WalletFeaturedActionSlot[];
  barcodeFormat: "QR" | "PDF417" | "Aztec" | "Code128";
  barcodeAltText: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type WalletPassRestaurantConfig = {
  restaurantId: string;
  enabled: boolean;
  organizationName: string;
  logoText: string;
  featuredActions: WalletFeaturedAction[];
  colorPreset: "dark" | "blue" | "green" | "red" | "purple" | "orange";
  color: string | null;
  logoURL: string | null;
  stripURL: string | null;
  iconURL: string | null;
  wideLogoURL: string | null;
  thumbnailURL: string | null;
  backgroundURL: string | null;
  locations: WalletPassLocation[];
  updatedAt: string | null;
  updatedBy: string | null;
};

/** Merged template + restaurant config used for preview and pass issue. */
export type WalletPassConfig = {
  restaurantId: string;
  enabled: boolean;
  organizationName: string;
  logoText: string;
  description: string;
  programTitle: string;
  pointsLabel: string;
  memberNameLabel: string;
  primaryFields: WalletPassField[];
  secondaryFields: WalletPassField[];
  headerFields: WalletPassField[];
  footerFields: WalletPassField[];
  backFields: WalletPassField[];
  featuredActions: WalletFeaturedAction[];
  barcodeFormat: "QR" | "PDF417" | "Aztec" | "Code128";
  barcodeAltText: string | null;
  colorPreset: WalletPassRestaurantConfig["colorPreset"];
  color: string | null;
  logoURL: string | null;
  stripURL: string | null;
  iconURL: string | null;
  wideLogoURL: string | null;
  thumbnailURL: string | null;
  backgroundURL: string | null;
  locations: WalletPassLocation[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export type WalletPassRestaurantInput = {
  enabled: boolean;
  organizationName: string;
  logoText: string;
  featuredActions: WalletFeaturedAction[];
  colorPreset: WalletPassRestaurantConfig["colorPreset"];
  color: string | null;
  logoURL: string | null;
  stripURL: string | null;
  iconURL: string | null;
  wideLogoURL: string | null;
  thumbnailURL: string | null;
  backgroundURL: string | null;
  locations: WalletPassLocation[];
};

/** @deprecated Use WalletPassRestaurantInput */
export type WalletPassConfigInput = WalletPassRestaurantInput;

export type WalletPassSystemTemplateInput = {
  description: string;
  programTitle: string;
  pointsLabel: string;
  memberNameLabel: string;
  primaryFields: WalletPassField[];
  secondaryFields: WalletPassField[];
  headerFields: WalletPassField[];
  footerFields: WalletPassField[];
  backFields: WalletPassField[];
  featuredActionSlots: WalletFeaturedActionSlot[];
  barcodeFormat: WalletPassSystemTemplate["barcodeFormat"];
  barcodeAltText: string | null;
};

export type WalletConfigBundle = {
  restaurant: WalletPassRestaurantConfig;
  template: WalletPassSystemTemplate;
  effective: WalletPassConfig;
};

export type WalletMarketingSendResult = {
  ok: true;
  targeted: number;
  succeeded: number;
  failed: number;
  errors: Array<{ guestId: string; message: string }>;
};

export type WalletPassInfo = {
  serialNumber: string;
  shareUrl: string;
  googleSaveUrl: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function getWalletConfigWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
) {
  return loyaltyApiJson<WalletConfigBundle>({
    path: "/api/admin/wallet/config",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function putWalletConfigWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  input: WalletPassRestaurantInput,
) {
  return loyaltyApiJson<WalletConfigBundle>({
    path: "/api/admin/wallet/config",
    method: "PUT",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function getWalletSystemTemplateWithAuthServer(accessToken: string) {
  return loyaltyApiJson<{ template: WalletPassSystemTemplate }>({
    path: "/api/admin/wallet/system-template",
    method: "GET",
    accessToken,
  });
}

export async function putWalletSystemTemplateWithAuthServer(
  accessToken: string,
  input: WalletPassSystemTemplateInput,
) {
  return loyaltyApiJson<{ template: WalletPassSystemTemplate }>({
    path: "/api/admin/wallet/system-template",
    method: "PUT",
    accessToken,
    body: input,
  });
}

export async function previewWalletMarketingWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  params: {
    segmentKeys?: LoyaltySegmentKey[];
    requireMarketingConsent?: boolean;
  } = {},
) {
  const search = new URLSearchParams();
  if (params.segmentKeys?.length) {
    search.set("segments", params.segmentKeys.join(","));
  }
  if (params.requireMarketingConsent === false) {
    search.set("requireMarketingConsent", "false");
  }
  const qs = search.toString();
  return loyaltyApiJson<{ count: number }>({
    path: `/api/admin/wallet/messages/preview${qs ? `?${qs}` : ""}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function sendWalletMarketingWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  input: {
    message: string;
    segmentKeys?: LoyaltySegmentKey[];
    requireMarketingConsent?: boolean;
  },
) {
  return loyaltyApiJson<WalletMarketingSendResult>({
    path: "/api/admin/wallet/messages",
    method: "POST",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function getGuestWalletWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  guestId: string,
) {
  return loyaltyApiJson<{ pass: WalletPassInfo | null }>({
    path: `/api/admin/guests/${encodeURIComponent(guestId)}/wallet`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function revokeGuestWalletWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  guestId: string,
) {
  return loyaltyApiVoid({
    path: `/api/admin/guests/${encodeURIComponent(guestId)}/wallet`,
    method: "DELETE",
    accessToken,
    restaurantId,
  });
}
