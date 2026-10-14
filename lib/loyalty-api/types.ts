export type LoyaltyGuest = {
  id: string;
  restaurantId: string;
  phoneE164: string;
  name: string;
  balance: number;
  status: string;
  marketingConsent: boolean;
  consentVersion: string;
  doSyncPending: boolean;
  lastVisitedAt: string | null;
  lifetimeSpendMinor: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LoyaltyLedgerEntry = {
  id: string;
  kind: string;
  points: number;
  promotionId: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string | null;
};

export type LoyaltyPromotion = {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  type: string;
  rules: unknown;
  pointsCost: number | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type GuestsListParams = {
  q?: string;
  status?: "active" | "blocked";
  lastVisitedFrom?: string;
  lastVisitedTo?: string;
  minSpend?: number;
  maxSpend?: number;
  page?: number;
  limit?: number;
  sort?: "createdAt" | "lastVisitedAt" | "lifetimeSpendMinor" | "balance" | "name";
  order?: "asc" | "desc";
};

export type GuestsListResponse = {
  guests: LoyaltyGuest[];
  total: number;
  page: number;
  limit: number;
  currency: string;
};

export type GuestDetailResponse = {
  guest: LoyaltyGuest;
  recentTransactions: LoyaltyLedgerEntry[];
};
export type PromotionsListResponse = { promotions: LoyaltyPromotion[] };
export type PromotionResponse = { promotion: LoyaltyPromotion };
export type PointsMutationResponse = {
  ledgerEntryId: string;
  balance: number;
  doSyncPending: boolean;
};
