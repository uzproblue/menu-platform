export type LoyaltyGuest = {
  id: string;
  restaurantId: string;
  phoneE164: string;
  name: string;
  dateOfBirth?: string | null;
  email?: string | null;
  balance: number;
  status: string;
  marketingConsent: boolean;
  consentVersion: string;
  isLegacy?: boolean;
  walletInstalledAt?: string | null;
  walletPlatform?: "apple" | "google" | string | null;
  legacyConvertedAt?: string | null;
  whatsappVerifiedAt?: string | null;
  telegramVerifiedAt?: string | null;
  iikoCustomerId?: string | null;
  iikoPulledAt?: string | null;
  iikoWhenRegisteredAt?: string | null;
  iikoFirstOrderAt?: string | null;
  lastVisitedAt: string | null;
  lifetimeSpendMinor: number;
  visitCount?: number;
  visits90d?: number;
  spend90d?: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LoyaltySegmentKey =
  | "champions"
  | "loyal"
  | "potential_loyalists"
  | "new_members"
  | "at_risk"
  | "lapsed"
  | "hibernating"
  | "birthday_this_week"
  | "high_balance";

export type LoyaltySegmentSummary = {
  key: LoyaltySegmentKey | string;
  labelEn: string;
  descriptionEn: string;
  isOverlay: boolean;
  sortOrder: number;
  ruleVersion: string;
  memberCount: number;
  avgSpendMinor: number;
  avgVisits: number;
  avgDaysSinceVisit: number | null;
};

export type LoyaltySegmentJobRun = {
  id: string;
  status: string;
  guestCount: number;
  runDate: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
};

export type SegmentsListResponse = {
  segments: LoyaltySegmentSummary[];
  runDate: string | null;
  lastRun: LoyaltySegmentJobRun | null;
};

export type SegmentMembersResponse = {
  segmentKey: string;
  guests: LoyaltyGuest[];
  total: number;
  page: number;
  limit: number;
};

export type LoyaltySegmentAction = {
  id: string;
  restaurantId: string;
  runDate: string;
  segmentKey: string | null;
  type: string;
  title: string;
  body: string;
  priority: number;
  ctaType: "create_promotion" | "view_members" | "birthday_campaign" | string;
  ctaPayload: Record<string, unknown>;
  status: "open" | "dismissed" | "acted" | string;
  source: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SegmentActionsResponse = {
  runDate: string;
  actions: LoyaltySegmentAction[];
};

export type SegmentRunResponse = {
  queued: boolean;
  runDate?: string;
  jobRunId?: string;
  guestCount?: number;
  actionCount?: number;
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

export type LoyaltyGuestOrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  positionId: string | null;
  attribution: "attributed" | "shared" | string;
  modifiers: unknown[];
};

export type LoyaltyGuestOrder = {
  id: string;
  externalOrderId: string;
  occurredAt: string | null;
  amountMinor: number;
  currency: string;
  pointsEarned: number;
  source: string;
  locationId: string | null;
  waiterId: string | null;
  waiterName: string | null;
  items: LoyaltyGuestOrderItem[];
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

export type GuestsListSort =
  | "createdAt"
  | "lastVisitedAt"
  | "lifetimeSpendMinor"
  | "balance"
  | "name"
  | "visitCount"
  | "visits90d"
  | "spend90d"
  | "phoneE164"
  | "whatsappVerifiedAt"
  | "telegramVerifiedAt"
  | "iikoPulledAt"
  | "iikoFirstOrderAt"
  | "walletInstalledAt"
  | "walletPlatform";

export type GuestsListParams = {
  q?: string;
  status?: "active" | "blocked";
  isLegacy?: boolean;
  lastVisitedFrom?: string;
  lastVisitedTo?: string;
  minSpend?: number;
  maxSpend?: number;
  minVisits?: number;
  maxVisits?: number;
  minBalance?: number;
  maxBalance?: number;
  verified?: "whatsapp" | "telegram" | "any" | "none";
  hasWallet?: boolean;
  walletPlatform?: "apple" | "google";
  iikoMatched?: boolean;
  marketingConsent?: boolean;
  page?: number;
  limit?: number;
  sort?: GuestsListSort;
  order?: "asc" | "desc";
};

export type GuestsListResponse = {
  guests: LoyaltyGuest[];
  total: number;
  page: number;
  limit: number;
  /** Null until the restaurant has an earn config. */
  currency: string | null;
  earnConfigured?: boolean;
};

export type GuestDetailResponse = {
  guest: LoyaltyGuest;
  recentTransactions: LoyaltyLedgerEntry[];
  orders?: LoyaltyGuestOrder[];
};
export type PromotionsListResponse = { promotions: LoyaltyPromotion[] };
export type PromotionResponse = { promotion: LoyaltyPromotion };
export type PointsMutationResponse = {
  ledgerEntryId: string;
  balance: number;
};
