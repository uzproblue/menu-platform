export type PromotionStoryMediaType = "photo" | "video";
export type PromotionStoryPricingMode = "fixed" | "percent_off" | "amount_off";

export type PromotionStoryTranslation = {
  lang: string;
  title: string;
  subtitle: string;
  badge: string | null;
  actionText: string | null;
};

export type PromotionStoryProduct = {
  menuItemId: string;
  quantity: number;
  sortOrder: number;
};

export type PromotionStory = {
  id: string;
  restaurantId: string;
  mediaType: PromotionStoryMediaType;
  mediaUrl: string;
  previewImageUrl: string;
  durationMs: number | null;
  badgeColor: string | null;
  pricingMode: PromotionStoryPricingMode;
  pricingValue: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  translations: PromotionStoryTranslation[];
  products: PromotionStoryProduct[];
  locationIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PromotionStoriesListResponse = {
  restaurantId: string;
  stories: PromotionStory[];
};

export type PromotionStoryResponse = {
  story: PromotionStory;
};

export type PromotionStoryMutationBody = {
  mediaType: PromotionStoryMediaType;
  mediaUrl: string;
  previewImageUrl: string;
  durationMs?: number | null;
  badgeColor?: string | null;
  pricingMode: PromotionStoryPricingMode;
  pricingValue: string | number;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  sortOrder?: number;
  translations: Array<{
    lang: string;
    title: string;
    subtitle?: string;
    badge?: string | null;
    actionText?: string | null;
  }>;
  products: Array<{
    menuItemId: string;
    quantity: number;
    sortOrder?: number;
  }>;
  locationIds: string[];
};
