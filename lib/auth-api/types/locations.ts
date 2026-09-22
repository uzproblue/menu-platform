export type Location = {
  id: string;
  name: string;
  type?: "dine_in" | "delivery";
  currency: string;
  address: string;
  logoUrl: string;
  /** Storefront header / background banner image (delivery & public). */
  coverImageUrl?: string;
  /** Optional center image for table QR codes; falls back to logoUrl when empty. */
  qrCenterImageUrl?: string;
  /** Restaurant contact phone number for delivery orders & support. */
  phoneNumber?: string;
  /** Verified venue latitude. */
  latitude?: number | null;
  /** Verified venue longitude. */
  longitude?: number | null;
  translationLangs: string[];
  /** Menu category ids enabled for this location (subset of restaurant catalog). */
  enabledCategoryIds: string[];
  /** Menu section ids enabled for this location (standard sections only). */
  enabledSectionIds: string[];
  /** iikoCloud organization UUID for stop-list webhook routing. */
  posOrganizationId?: string;
  /** Optional iiko terminal group UUID. */
  posTerminalGroupId?: string;
  /** Optional iiko API token for stop-list and pos sync. */
  posApiToken?: string | null;
  /** Telegram chat id for staff stop-list alerts. */
  chefAlertChatId?: string;
  instagramUrl?: string;
  twoGisUrl?: string;
  ordersEnabled: boolean;
  /** Optional custom domain for delivery storefront routing via Cloudflare KV. */
  customDomain?: string | null;
  isDefault: boolean;
  isActive: boolean;
  categoryCount: number;
  menuItemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateLocationInput = {
  name: string;
  type?: "dine_in" | "delivery";
  currency: string;
  translationLangs: string[];
  logoUrl?: string;
  coverImageUrl?: string;
  address?: string;
  phoneNumber?: string;
  latitude?: number | null;
  longitude?: number | null;
  customDomain?: string | null;
  copyMenuFromLocationId?: string | null;
};

export type CreateLocationResponse = {
  location: {
    id: string;
    name: string;
    type?: "dine_in" | "delivery";
    currency: string;
    logoUrl: string;
    coverImageUrl?: string;
    phoneNumber?: string;
    latitude?: number | null;
    longitude?: number | null;
    translationLangs: string[];
    customDomain?: string | null;
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type LocationsResponse = {
  restaurantId: string;
  currentUserRole: "ADMIN" | "USER";
  locations: Location[];
};

export type UpdateLocationActivationResponse = {
  location: {
    id: string;
    name: string;
    isDefault: boolean;
    isActive: boolean;
  };
};

export type UpdateLocationCategoriesResponse = {
  location: {
    id: string;
    enabledCategoryIds: string[];
    updatedAt: string;
  };
};

export type UpdateLocationSectionsResponse = {
  location: {
    id: string;
    enabledSectionIds: string[];
    updatedAt: string;
  };
};

export type GetLocationResponse = {
  location: Location;
};

export type LocationDiningTable = {
  id: string;
  posId: string;
  number: number;
  chosen: boolean;
};

export type LocationDiningTablesSection = {
  sectionName: string;
  tables: LocationDiningTable[];
};

export type LocationDiningTablesResponse = {
  sections: LocationDiningTablesSection[];
};

export type UpdateDiningTableChoicesInput = {
  chosenTableIds: string[];
};

export type UpdateLocationDetailsInput = {
  name?: string;
  type?: "dine_in" | "delivery";
  currency?: string;
  logoUrl?: string;
  coverImageUrl?: string | null;
  qrCenterImageUrl?: string;
  address?: string | null;
  phoneNumber?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  translationLangs?: string[];
  posOrganizationId?: string | null;
  posTerminalGroupId?: string | null;
  posApiToken?: string | null;
  chefAlertChatId?: string | null;
  instagramUrl?: string | null;
  twoGisUrl?: string | null;
  ordersEnabled?: boolean;
  customDomain?: string | null;
};

export type UpdateLocationDetailsResponse = {
  location: {
    id: string;
    name: string;
    type?: "dine_in" | "delivery";
    currency: string;
    address: string;
    logoUrl: string;
    coverImageUrl?: string;
    qrCenterImageUrl?: string;
    phoneNumber?: string;
    latitude?: number | null;
    longitude?: number | null;
    translationLangs: string[];
    enabledCategoryIds: string[];
    enabledSectionIds: string[];
    posOrganizationId?: string;
    posTerminalGroupId?: string;
    posApiToken?: string;
    chefAlertChatId?: string;
    instagramUrl?: string;
    twoGisUrl?: string;
    ordersEnabled: boolean;
    customDomain?: string | null;
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type CloneLocationMenuResponse = {
  ok: boolean;
  categoryCount: number;
  itemCount: number;
  location?: Location;
};

export type PutLocationMenuItemInput = {
  menuItemId: string;
  price: string | number;
  grammUseDefault?: boolean;
  gramm?: string | null;
  imageUseDefault?: boolean;
  image?: string | null;
};

export type PutLocationMenuItemsInput = {
  items: PutLocationMenuItemInput[];
};

export type PutLocationMenuItemsResponse = {
  locationId: string;
  itemCount: number;
  createdCatalogPrices: number;
};

export type PatchLocationMenuItemsInput = {
  add?: PutLocationMenuItemInput[];
  update?: PutLocationMenuItemInput[];
  remove?: string[];
};

export type PatchLocationMenuItemsResponse = {
  locationId: string;
  added: number;
  reenabled?: number;
  updated: number;
  disabled?: number;
  /** @deprecated use `disabled` — server soft-disables instead of deleting */
  removed?: number;
  createdCatalogPrices: number;
};

export type LocationMenuItemRow = {
  menuItemId: string;
  categoryId?: string;
  price: string;
  enabled: boolean;
  grammUseDefault?: boolean;
  globalGramm?: string;
  gramm?: string;
  resolvedGramm?: string;
  imageUseDefault?: boolean;
  globalImage?: string;
  image?: string;
  resolvedImage?: string;
};

export type LocationMenuItemsResponse = {
  locationId: string;
  items: LocationMenuItemRow[];
};

export type PatchLocationMenuItemEnabledInput = {
  enabled: boolean;
  price?: string;
  grammUseDefault?: boolean;
  gramm?: string | null;
  imageUseDefault?: boolean;
  image?: string | null;
};

export type PatchLocationMenuItemEnabledResponse = {
  locationId: string;
  menuItemId: string;
  enabled: boolean;
  price: string;
  grammUseDefault?: boolean;
  gramm?: string;
  resolvedGramm?: string;
};
