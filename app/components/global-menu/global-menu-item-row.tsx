import Image from "next/image";
import type { MenuItem } from "@/lib/data/global-menu-types";
import { useI18n } from "../i18n-provider";

const CARD_IMAGE_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 400px";

export function ItemThumbnail({
  src,
  alt,
  sizes = CARD_IMAGE_SIZES,
}: {
  src: string;
  alt: string;
  sizes?: string;
}) {
  const remote = /^https?:\/\//i.test(src);
  const svg = /\.svg(\?|$)/i.test(src);

  if (remote || svg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote URLs and SVGs skip next/image config
      <img
        src={src}
        alt={alt}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover"
      sizes={sizes}
      loading="lazy"
    />
  );
}

function ItemActiveToggle({
  active,
  onToggle,
  disabled,
  disableLabel,
  enableLabel,
}: {
  active: boolean;
  onToggle: () => void;
  disabled: boolean;
  disableLabel: string;
  enableLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? disableLabel : enableLabel}
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-8 w-[3.35rem] shrink-0 cursor-pointer items-center rounded-full border border-foreground/15 px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
          active ? "justify-end bg-foreground/25" : "justify-start bg-foreground/8"
        }`}
      >
        <span className="pointer-events-none block size-6 rounded-full bg-background shadow-sm ring-1 ring-foreground/10" />
      </button>
    </div>
  );
}

function formatCatalogPrices(prices: MenuItem["prices"]): string {
  if (!prices.length) return "";
  return prices.map((p) => `${p.price} ${p.currency}`).join(" · ");
}

function isActive(item: MenuItem) {
  return item.active !== false;
}

function NoImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,oklch(0.55_0.02_260/0.12),oklch(0.55_0.04_280/0.08))] text-foreground/35 dark:bg-[linear-gradient(145deg,oklch(1_0_0/0.06),oklch(1_0_0/0.03))]">
      <svg
        className="size-12 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.25}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

type GlobalMenuItemRowProps = {
  item: MenuItem;
  categoryId: string;
  onEdit: (categoryId: string, itemId: string) => void;
  onToggleActive: (categoryId: string, itemId: string) => void;
  onDelete: (categoryId: string, itemId: string) => void;
  isBusy?: boolean;
  /** When true, hides the edit overlay button (e.g. read-only restaurant menu view). */
  hideEditButton?: boolean;
};

export function GlobalMenuItemRow({
  item,
  categoryId,
  onEdit,
  onToggleActive,
  onDelete,
  isBusy = false,
  hideEditButton = false,
}: GlobalMenuItemRowProps) {
  const { t } = useI18n();
  const hasImage = Boolean(item.image?.trim());
  const active = isActive(item);

  return (
    <li className="h-full min-w-0 list-none">
      <article
        className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-background/70 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md transition-[opacity,box-shadow] hover:ring-foreground/15 ${
          active ? "" : "opacity-90"
        }`}
      >
        <div className="relative aspect-4/3 w-full shrink-0 overflow-hidden bg-foreground/5">
          {hasImage ? (
            <ItemThumbnail src={item.image!} alt={item.name} />
          ) : (
            <NoImagePlaceholder label={t("global.noImage")} />
          )}

          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent opacity-90" />

          <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1.5 sm:left-3 sm:top-3">
            <span
              className={`pointer-events-auto rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 backdrop-blur-sm ${
                active
                  ? "bg-emerald-500/20 text-emerald-800 ring-emerald-500/30 dark:text-emerald-200"
                  : "bg-foreground/15 text-foreground/75 ring-foreground/20"
              }`}
            >
              {active ? t("global.enabled") : t("global.disabled")}
            </span>
            {item.tags?.length
              ? item.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="pointer-events-auto rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/70 ring-1 ring-foreground/10 backdrop-blur-sm"
                  >
                    {tag}
                  </span>
                ))
              : null}
          </div>

          {hideEditButton ? null : (
            <div className="absolute right-2 top-2 z-10 flex items-center gap-2 sm:right-3 sm:top-3">
              <button
                type="button"
                onClick={() => onEdit(categoryId, item.id)}
                disabled={isBusy}
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border border-foreground/15 bg-background/90 text-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-md transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-55"
                aria-label={t("global.editItemAria", { name: item.name })}
              >
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onDelete(categoryId, item.id)}
                disabled={isBusy}
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border border-red-400/40 bg-background/90 text-red-700 shadow-md ring-1 ring-red-400/25 backdrop-blur-md transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-55 dark:text-red-300"
                aria-label={t("global.deleteItemAria", { name: item.name })}
              >
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
          <h3
            className={`text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl ${
              active ? "" : "line-through decoration-foreground/35"
            }`}
          >
            {item.name}
          </h3>
          {item.description ? (
            <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-foreground/65">
              {item.description}
            </p>
          ) : (
            <p className="flex-1 text-sm italic text-foreground/40">{t("global.noDescription")}</p>
          )}

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-foreground/10 pt-3">
            {item.prices.length > 0 ? (
              <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground sm:text-xl">
                {formatCatalogPrices(item.prices)}
              </p>
            ) : (
              <span className="text-sm text-foreground/45">—</span>
            )}
            <ItemActiveToggle
              active={active}
              onToggle={() => onToggleActive(categoryId, item.id)}
              disabled={isBusy}
              disableLabel={t("global.disableItem")}
              enableLabel={t("global.enableItem")}
            />
          </div>
        </div>
      </article>
    </li>
  );
}
