export type UpdateProfileNameResponse = {
  id: string;
  email: string;
  name: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: { id: string; email: string; name: string };
};

export type ProvisionRestaurantResponse = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    subscriptionStartsAt: string | null;
    subscriptionEndsAt: string | null;
  };
  defaultLocation: {
    id: string;
    restaurantId: string;
    name: string;
    currency: string;
    isDefault: boolean;
  };
  defaultCategories: Array<{
    id: string;
    name: string;
    sortOrder: number;
  }>;
  admin: {
    email: string;
    temporaryPassword: string;
  };
  welcomeEmailSent?: boolean;
};

export type ProvisionRestaurantInput = {
  adminApiKey: string;
  name: string;
  slug: string;
  adminEmail: string;
  adminName?: string | null;
};
