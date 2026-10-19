export type LoyaltyGuest = {
  id: string;
  restaurantId: string;
  phoneE164: string;
  name: string;
  dateOfBirth?: string;
  balance: number;
  status: string;
  marketingConsent: boolean;
  consentVersion: string;
  doSyncPending: boolean;
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
