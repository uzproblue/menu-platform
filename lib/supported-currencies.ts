/** ISO 4217 codes accepted by menu-server (keep in sync with menu-server/src/lib/currency.ts). */
export const SUPPORTED_CATALOG_CURRENCIES = [
  "UZS",
  "RUB",
  "KZT",
  "USD",
  "KGS",
] as const;

export type SupportedCatalogCurrency = (typeof SUPPORTED_CATALOG_CURRENCIES)[number];
