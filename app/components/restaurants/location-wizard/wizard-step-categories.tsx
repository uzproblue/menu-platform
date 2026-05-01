import clsx from "clsx";
import type { Category } from "@/lib/auth-api";
import { useI18n } from "@/app/components/i18n-provider";

type WizardStepCategoriesProps = {
  catalogLoading: boolean;
  categoriesLoadError: string | null;
  allCategories: Category[];
  selectedCategoryIds: string[];
  toggleCategory: (id: string) => void;
  onOpenCreateCategory: () => void;
  isSavingStep2: boolean;
  onBack: () => void;
  onNext: () => void;
};

export function WizardStepCategories({
  catalogLoading,
  categoriesLoadError,
  allCategories,
  selectedCategoryIds,
  toggleCategory,
  onOpenCreateCategory,
  isSavingStep2,
  onBack,
  onNext,
}: WizardStepCategoriesProps) {
  const { t } = useI18n();

  return (
    <div className="mt-8 space-y-6">
      {catalogLoading && (
        <p className="text-sm text-foreground/60">{t("restaurants.newWizard.loadingCatalog")}</p>
      )}
      {categoriesLoadError && (
        <p className="text-sm text-amber-800 dark:text-amber-200">{categoriesLoadError}</p>
      )}
      {!catalogLoading && (
        <>
          {allCategories.length === 0 && !categoriesLoadError && (
            <p className="mb-3 text-sm text-foreground/60">{t("restaurants.newWizard.noCategories")}</p>
          )}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allCategories.map((cat) => {
              const sel = selectedCategoryIds.includes(cat.id);
              const desc = cat.description?.trim();
              return (
                <li key={cat.id} className="min-w-0">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={sel}
                    aria-label={cat.name}
                    onClick={() => toggleCategory(cat.id)}
                    className={clsx(
                      "group relative h-full min-h-[8.5rem] w-full overflow-hidden rounded-xl border text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 sm:min-h-[9.25rem]",
                      sel
                        ? "border-emerald-500/80 ring-2 ring-emerald-500/50"
                        : "border-foreground/10 ring-1 ring-foreground/5 hover:border-foreground/20",
                    )}
                  >
                    {cat.coverPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- category cover URLs (remote or app paths)
                      <img
                        src={cat.coverPhoto}
                        alt={t("restaurants.newWizard.categoryCoverAlt", { name: cat.name })}
                        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 size-full bg-gradient-to-br from-foreground/15 to-foreground/5" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />

                    <div className="relative flex min-h-[inherit] items-start justify-between gap-2 p-3 sm:gap-2.5 sm:p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug tracking-tight text-white sm:text-base">
                          {cat.name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-snug text-white/80 sm:text-[13px]">
                          {desc || t("global.noDescription")}
                        </p>
                        <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-white/75 sm:text-xs">
                          {cat.itemsCount} {t("common.items")}
                        </p>
                      </div>
                      <div
                        className={clsx(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border-2 backdrop-blur-sm transition-colors sm:size-9",
                          sel
                            ? "border-emerald-300 bg-emerald-500 text-white"
                            : "border-white/45 bg-black/25 text-white/90 group-hover:border-white/60",
                        )}
                        aria-hidden
                      >
                        {sel ? (
                          <svg
                            className="size-4 sm:size-[1.05rem]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <span className="size-2 rounded-full bg-white/35 sm:size-2.5" />
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            <li className="min-w-0">
              <button
                type="button"
                onClick={onOpenCreateCategory}
                disabled={Boolean(categoriesLoadError)}
                className="flex h-full min-h-[8.5rem] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-foreground/20 bg-foreground/[0.02] p-3 text-center transition hover:border-foreground/35 hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[9.25rem]"
                aria-label={t("categories.addCategory")}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10 text-foreground/80">
                  <svg
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </span>
                <span className="text-sm font-medium text-foreground">{t("categories.addCategory")}</span>
              </button>
            </li>
          </ul>
        </>
      )}
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
          onClick={() => void onNext()}
          disabled={isSavingStep2}
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingStep2
            ? t("restaurants.newWizard.savingCategories")
            : t("restaurants.newWizard.next")}
        </button>
      </div>
    </div>
  );
}
