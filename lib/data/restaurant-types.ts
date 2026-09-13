export type LocationListRow = {
  id: string;
  name: string;
  type?: "dine_in" | "delivery";
  currency: string;
  address: string;
  logoUrl: string;
  coverImageUrl?: string;
  qrCenterImageUrl: string;
  phoneNumber?: string;
  latitude?: number | null;
  longitude?: number | null;
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
