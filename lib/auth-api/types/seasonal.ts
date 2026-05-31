export type SeasonalMenuDesignApi = {
  id: string;
  restaurantId: string;
  title: string;
  locationId: string | null;
  r2ObjectKey: string;
  createdAt: string;
  updatedAt: string;
};

export type SeasonalMenuDesignsListResponse = {
  restaurantId: string;
  designs: SeasonalMenuDesignApi[];
};

export type SeasonalMenuDesignResponse = {
  design: SeasonalMenuDesignApi;
};

export type CreateSeasonalMenuDesignInput = {
  title: string;
  locationId?: string | null;
};

export type PatchSeasonalMenuDesignInput = {
  title?: string;
  locationId?: string | null;
};

export type DeleteSeasonalMenuDesignResponse = {
  ok: true;
  r2ObjectKey: string;
};
