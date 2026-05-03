import Image from "next/image";
import type { Category, GlobalMenuItemApi } from "@/lib/auth-api";
import { useI18n } from "@/app/components/i18n-provider";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import { CUSTOM_PRICE_SELECTION, MANUAL_PRICE_SELECTION } from "./constants";
import {
  formatPriceSummary,
  getMatchingCatalogPrices,
} from "./pricing";
import type { SelectedItemRow } from "./types";

type WizardStepMenuProps = {
  menuLoadError: string | null;
  selectedCategoryIds: string[];
  allCategories: Category[];
  itemsByCategory: Map<string, GlobalMenuItemApi[]>;
  currency: string;
  selectedItems: Record<string, SelectedItemRow>;
  toggleItem: (categoryId: string, item: GlobalMenuItemApi) => void;
  setCategoryItemsSelected: (
    catId: string,
    items: GlobalMenuItemApi[],
    selectAll: boolean,
  ) => void;
  patchItemPrice: (
    itemId: string,
    item: GlobalMenuItemApi,
    patch: Partial<SelectedItemRow>,
  ) => void;
  publishing: boolean;
  onBack: () => void;
  onPublish: () => void;
};

export function WizardStepMenu({
  menuLoadError,
  selectedCategoryIds,
  allCategories,
  itemsByCategory,
  currency,
  selectedItems,
  toggleItem,
  setCategoryItemsSelected,
  patchItemPrice,
  publishing,
  onBack,
  onPublish,
}: WizardStepMenuProps) {
  const { t } = useI18n();

  return (
    <div className="mt-8 space-y-8">
      {menuLoadError && (
        <p className="text-sm text-amber-800 dark:text-amber-200">{menuLoadError}</p>
      )}
      {selectedCategoryIds.map((catId) => {
        const catMeta = allCategories.find((c) => c.id === catId);
        const items = itemsByCategory.get(catId) ?? [];
        const isLocalOnly = catId.startsWith("local-");
        const allItemsInCategorySelected =
          items.length > 0 && items.every((item) => Boolean(selectedItems[item.id]));

        return (
          <section key={catId} className="space-y-3">
            <div className="flex items-start gap-3">
              {!isLocalOnly && items.length > 0 ? (
                <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-1 text-sm text-foreground/80">
                  <span className="sr-only">
                    {t("restaurants.newWizard.selectAllInCategory", {
                      name: catMeta?.name ?? catId,
                    })}
                  </span>
                  <input
                    type="checkbox"
                    checked={allItemsInCategorySelected}
                    ref={(el) => {
                      if (!el) return;
                      const selectedCount = items.filter((i) => selectedItems[i.id]).length;
                      el.indeterminate =
                        selectedCount > 0 && selectedCount < items.length;
                    }}
                    onChange={(e) =>
                      setCategoryItemsSelected(catId, items, e.target.checked)
                    }
                    className="size-4 shrink-0 rounded border-foreground/30"
                  />
                </label>
              ) : null}
              <h2 className="min-w-0 flex-1 text-lg font-medium text-foreground">
                {catMeta?.name ?? catId}
              </h2>
            </div>
            {isLocalOnly ? (
              <p className="text-sm text-foreground/60">
                {t("restaurants.newWizard.localCategoryNoItems")}
              </p>
            ) : items.length === 0 ? (
              <p className="text-sm text-foreground/60">
                {t("restaurants.newWizard.noItemsInCategory")}
              </p>
            ) : (
              <ul className="divide-y divide-foreground/10 rounded-xl border border-foreground/10">
                {items.map((item, itemIdx) => {
                  const on = Boolean(selectedItems[item.id]);
                  const row = selectedItems[item.id];
                  const matchingPrices = getMatchingCatalogPrices(item, currency);
                  const priceRadioName = `wizard-item-price-${item.id}`;
                  return (
                    <li key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleItem(catId, item)}
                          className="mt-1 size-4 rounded border-foreground/30"
                        />
                        <span className="flex min-w-0 items-start gap-3">
                          <span className="relative mt-0.5 block size-12 shrink-0 overflow-hidden rounded-lg border border-foreground/10 bg-foreground/5">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.name}
                                width={48}
                                height={48}
                                className="size-full object-cover"
                                sizes="48px"
                                priority={itemIdx < 12}
                                {...(itemIdx >= 12 ? { loading: "lazy" as const } : {})}
                                unoptimized={imageSrcIsNonOptimizable(item.image)}
                              />
                            ) : (
                              <span className="flex size-full items-center justify-center text-[10px] font-medium text-foreground/45">
                                {t("global.noImage")}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-foreground">{item.name}</span>
                            <span className="mt-0.5 line-clamp-2 block text-xs text-foreground/60">
                              {item.description?.trim() || t("global.noDescription")}
                            </span>
                            <span className="mt-1 block text-xs text-foreground/55">
                              {matchingPrices.length === 0
                                ? t("restaurants.newWizard.noCatalogPriceInLocationCurrency", {
                                    currency,
                                  })
                                : t("restaurants.newWizard.listPricesInLocationCurrency", {
                                    currency,
                                    list: matchingPrices.map(formatPriceSummary).join(", "),
                                  })}
                            </span>
                          </span>
                        </span>
                      </label>
                      {on && row && (
                        <fieldset className="min-w-0 shrink-0 space-y-2 border-0 p-0 sm:min-w-[12rem] sm:pl-2">
                          <legend className="sr-only">
                            {t("restaurants.newWizard.itemPriceGroupLabel", { name: item.name })}
                          </legend>
                          {matchingPrices.length === 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="sr-only" htmlFor={`price-manual-${item.id}`}>
                                {t("restaurants.newWizard.locationPrice")}
                              </label>
                              <span className="text-xs text-foreground/55">{currency}</span>
                              <input
                                id={`price-manual-${item.id}`}
                                value={row.overridePrice}
                                onChange={(e) =>
                                  patchItemPrice(item.id, item, {
                                    overridePrice: e.target.value,
                                    priceSelection: MANUAL_PRICE_SELECTION,
                                  })
                                }
                                className="w-28 rounded-lg border border-foreground/15 bg-background/80 px-2 py-1.5 text-sm outline-none ring-foreground/20 focus:ring-2"
                                inputMode="decimal"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {matchingPrices.map((p) => (
                                <label
                                  key={p.id}
                                  className="flex cursor-pointer items-center gap-2 text-sm"
                                >
                                  <input
                                    type="radio"
                                    name={priceRadioName}
                                    value={p.id}
                                    checked={row.priceSelection === p.id}
                                    onChange={() =>
                                      patchItemPrice(item.id, item, { priceSelection: p.id })
                                    }
                                    className="size-4 shrink-0 border-foreground/30 text-foreground"
                                  />
                                  <span className="tabular-nums text-foreground">
                                    {formatPriceSummary(p)}
                                  </span>
                                </label>
                              ))}
                              {row.customOptionAdded ? (
                                <label className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    name={priceRadioName}
                                    value={CUSTOM_PRICE_SELECTION}
                                    checked={row.priceSelection === CUSTOM_PRICE_SELECTION}
                                    onChange={() =>
                                      patchItemPrice(item.id, item, {
                                        priceSelection: CUSTOM_PRICE_SELECTION,
                                      })
                                    }
                                    className="size-4 shrink-0 border-foreground/30 text-foreground"
                                  />
                                  <span className="text-xs text-foreground/70">
                                    {t("restaurants.newWizard.customPriceOption")}
                                  </span>
                                  <input
                                    id={`price-custom-${item.id}`}
                                    value={row.customPriceDraft}
                                    onChange={(e) =>
                                      patchItemPrice(item.id, item, {
                                        customPriceDraft: e.target.value,
                                        priceSelection: CUSTOM_PRICE_SELECTION,
                                      })
                                    }
                                    className="w-28 rounded-lg border border-foreground/15 bg-background/80 px-2 py-1.5 text-sm outline-none ring-foreground/20 focus:ring-2"
                                    inputMode="decimal"
                                  />
                                  <span className="text-xs text-foreground/55">{currency}</span>
                                </label>
                              ) : null}
                              {!row.customOptionAdded ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    patchItemPrice(item.id, item, {
                                      customOptionAdded: true,
                                      priceSelection: CUSTOM_PRICE_SELECTION,
                                      customPriceDraft: "",
                                    })
                                  }
                                  className="self-start rounded-lg border border-foreground/15 bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/80 transition hover:bg-foreground/10"
                                >
                                  {t("restaurants.newWizard.addCustomPrice")}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </fieldset>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      <div className="flex flex-wrap justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-foreground/15 px-4 py-2.5 text-sm"
        >
          {t("restaurants.newWizard.back")}
        </button>
        <button
          type="button"
          onClick={() => void onPublish()}
          disabled={publishing}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {publishing
            ? t("restaurants.newWizard.publishing")
            : t("restaurants.newWizard.publish")}
        </button>
      </div>
    </div>
  );
}
