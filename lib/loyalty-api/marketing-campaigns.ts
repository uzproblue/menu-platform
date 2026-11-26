import { loyaltyApiJson } from "./client";

export type MarketingCampaignFilters = {
  q?: string;
  status?: string;
  lastVisitedFrom?: string;
  lastVisitedTo?: string;
  minSpend?: number;
  maxSpend?: number;
  minVisits?: number;
  maxVisits?: number;
  minBalance?: number;
  maxBalance?: number;
  verified?: string;
  hasWallet?: boolean;
  walletPlatform?: string;
  iikoMatched?: boolean;
  marketingConsent?: boolean;
  acquisitionSource?: string;
};

export type MarketingCampaign = {
  id: string;
  restaurantId: string;
  status: string;
  channel: string;
  message: string;
  senderPhoneE164: string;
  filters: Record<string, unknown>;
  targeted: number;
  succeeded: number;
  failed: number;
  errorSample: Array<{ guestId: string; message: string }>;
  createdAt: string;
  completedAt: string | null;
};

export type MarketingCampaignPreview = {
  ok: true;
  matching: number;
  reachable: number;
  capped: boolean;
  marketingReady: boolean;
  senderPhoneE164: string | null;
  filters: Record<string, unknown>;
};

export async function listMarketingCampaignsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
) {
  return loyaltyApiJson<{ campaigns: MarketingCampaign[] }>({
    path: "/api/admin/marketing-campaigns",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function getMarketingCampaignWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  id: string,
) {
  return loyaltyApiJson<{ campaign: MarketingCampaign }>({
    path: `/api/admin/marketing-campaigns/${encodeURIComponent(id)}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function previewMarketingCampaignWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  filters: MarketingCampaignFilters,
) {
  return loyaltyApiJson<MarketingCampaignPreview>({
    path: "/api/admin/marketing-campaigns/preview",
    method: "POST",
    accessToken,
    restaurantId,
    body: { filters },
  });
}

export async function createMarketingCampaignWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  input: { filters: MarketingCampaignFilters; message: string },
) {
  return loyaltyApiJson<{ campaign: MarketingCampaign }>({
    path: "/api/admin/marketing-campaigns",
    method: "POST",
    accessToken,
    restaurantId,
    body: input,
  });
}
