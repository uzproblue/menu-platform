export type Location = {
  id: string;
  name: string;
  currency: string;
  address: string;
  logoUrl: string;
  /** Optional center image for table QR codes; falls back to logoUrl when empty. */
  qrCenterImageUrl?: string;
  translationLangs: string[];
  /** Menu category ids enabled for this location (subset of restaurant catalog). */
  enabledCategoryIds: string[];
  /** Menu section ids enabled for this location (standard sections only). */
  enabledSectionIds: string[];
  /** iikoCloud organization UUID for stop-list webhook routing. */
  posOrganizationId?: string;
  /** Optional iiko terminal group UUID. */
  posTerminalGroupId?: string;
  /** Telegram chat id for staff stop-list alerts. */
  chefAlertChatId?: string;
  instagramUrl?: string;
  twoGisUrl?: string;
  ordersEnabled: boolean;
  isDefault: boolean;
  isActive: boolean;
  categoryCount: number;
  menuItemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateLocationInput = {
  name: string;
  currency: string;
  translationLangs: string[];
  logoUrl?: string;
  address?: string;
};

export type CreateLocationResponse = {
  location: {
    id: string;
    name: string;
    currency: string;
    logoUrl: string;
    translationLangs: string[];
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
  currency?: string;
  logoUrl?: string;
  qrCenterImageUrl?: string;
  address?: string | null;
  translationLangs?: string[];
  posOrganizationId?: string | null;
  posTerminalGroupId?: string | null;
  chefAlertChatId?: string | null;
  instagramUrl?: string | null;
  twoGisUrl?: string | null;
  ordersEnabled?: boolean;
};

export type UpdateLocationDetailsResponse = {
  location: {
    id: string;
    name: string;
    currency: string;
    address: string;
    logoUrl: string;
    qrCenterImageUrl?: string;
    translationLangs: string[];
    enabledCategoryIds: string[];
    enabledSectionIds: string[];
    posOrganizationId?: string;
    posTerminalGroupId?: string;
    chefAlertChatId?: string;
    instagramUrl?: string;
    twoGisUrl?: string;
    ordersEnabled: boolean;
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
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
