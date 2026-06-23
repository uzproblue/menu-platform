export type LocationListRow = {
  id: string;
  name: string;
  currency: string;
  address: string;
  logoUrl: string;
  qrCenterImageUrl: string;
  enabledCategoryIds: string[];
  isDefault: boolean;
  isActive: boolean;
  categoryCount: number;
  menuItemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RestaurantsListData = {
  restaurantId: string;
  currentUserRole: "ADMIN" | "USER";
  locations: LocationListRow[];
};
