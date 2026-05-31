export type MyRestaurantsResponse = {
  isOwner: boolean;
  restaurants: Array<{
    id: string;
    name: string;
    role: "ADMIN" | "USER" | "CHEF";
  }>;
  currentRestaurantId: string | null;
};

export type TeammatesResponse = {
  restaurantId: string;
  currentUserRole: "ADMIN" | "USER" | "CHEF";
  isOwner: boolean;
  teammates: Array<{
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "USER" | "CHEF";
    lastLoginAt: string | null;
    telegramPhone?: string | null;
    chefInviteStatus?: string | null;
    telegramLinked?: boolean;
    locationName?: string | null;
  }>;
};

export type CreateTeammateResponse = {
  teammate: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "USER" | "CHEF";
    lastLoginAt: string | null;
  };
  temporaryPassword: string | null;
  inviteEmailSent?: boolean;
  chefInvite?: {
    inviteId: string;
    pinCode: string;
    locationId: string;
    locationName: string;
  };
};

export type CreateTeammateInput =
  | { email: string; name: string; role: "ADMIN" | "USER"; restaurantIds?: string[] }
  | {
      name: string;
      role: "CHEF";
      telegramPhone: string;
      locationId: string;
    };

export type RevealTemporaryPasswordResponse = {
  temporaryPassword: string;
};
