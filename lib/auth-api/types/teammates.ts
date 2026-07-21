export type RestaurantStaffRole = "ADMIN" | "USER" | "CHEF" | "HOSTESS";

export type MyRestaurantsResponse = {
  isOwner: boolean;
  restaurants: Array<{
    id: string;
    name: string;
    role: RestaurantStaffRole;
  }>;
  currentRestaurantId: string | null;
};

export type TeammatesResponse = {
  restaurantId: string;
  currentUserRole: RestaurantStaffRole;
  isOwner: boolean;
  teammates: Array<{
    id: string;
    email: string;
    name: string;
    role: RestaurantStaffRole;
    lastLoginAt: string | null;
    telegramPhone?: string | null;
    chefInviteStatus?: string | null;
    telegramLinked?: boolean;
    hostessInviteStatus?: string | null;
    locationName?: string | null;
  }>;
};

export type CreateTeammateResponse = {
  teammate: {
    id: string;
    email: string;
    name: string;
    role: RestaurantStaffRole;
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
  hostessInvite?: {
    inviteId: string;
    pinCode: string;
    username: string;
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
    }
  | {
      name: string;
      role: "HOSTESS";
      locationId: string;
      username: string;
    };

export type RevealTemporaryPasswordResponse = {
  temporaryPassword: string;
};
