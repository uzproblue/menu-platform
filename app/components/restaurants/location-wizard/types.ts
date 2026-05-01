import type { CatalogPriceApi } from "@/lib/auth-api";

export type NewLocationWizardProps = {
  initialLocationId?: string | null;
};

export type SelectedItemRow = {
  categoryId: string;
  name: string;
  overridePrice: string;
  /** `manual` | `custom` | a catalog `CatalogPriceApi.id` from a matching-currency row */
  priceSelection: string;
  customPriceDraft: string;
  customOptionAdded: boolean;
};

export type SelectedItemsMap = Record<string, SelectedItemRow>;
