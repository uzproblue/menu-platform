"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/components/i18n-provider";
import type { MenuV3PreviewResponse } from "@/lib/auth-api";
import { buildImportActions } from "@/lib/menu-v3-populate-unassigned";

type Step = 1 | 2 | 3 | 4;

type CreatedRestaurant = {
  restaurantId: string;
  restaurantName: string;
  locationId: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const inputClassName =
  "w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition-[box-shadow,background-color] placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string; error?: string };
    if (typeof j.message === "string" && j.message.trim()) return j.message;
    if (typeof j.error === "string" && j.error.trim()) return j.error;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function AddRestaurantWizardModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRestaurant | null>(null);

  const [name, setName] = useState("");
  const [posOrganizationId, setPosOrganizationId] = useState("");
  const [posApiToken, setPosApiToken] = useState("");
  const [posTerminalGroupId, setPosTerminalGroupId] = useState("");
  const [externalMenuId, setExternalMenuId] = useState("");
  const [posTestOk, setPosTestOk] = useState(false);

  const [tablesSummary, setTablesSummary] = useState<string | null>(null);
  const [tablesOk, setTablesOk] = useState(false);
  const [menuSummary, setMenuSummary] = useState<string | null>(null);
  const [menuOk, setMenuOk] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPending(false);
    setError(null);
    setCreated(null);
    setName("");
    setPosOrganizationId("");
    setPosApiToken("");
    setPosTerminalGroupId("");
    setExternalMenuId("");
    setPosTestOk(false);
    setTablesSummary(null);
    setTablesOk(false);
    setMenuSummary(null);
    setMenuOk(false);
  }, [open]);

  if (!open) return null;

  async function selectRestaurantContext(restaurantId: string) {
    await fetch("/api/settings/restaurant-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    window.dispatchEvent(
      new CustomEvent("restaurant-context-changed", {
        detail: { restaurantId },
      }),
    );
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("addRestaurant.errNameRequired"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("addRestaurant.errCreate")));
      }
      const data = (await res.json()) as {
        restaurant: { id: string; name: string };
        defaultLocation: { id: string };
      };
      const next: CreatedRestaurant = {
        restaurantId: data.restaurant.id,
        restaurantName: data.restaurant.name,
        locationId: data.defaultLocation.id,
      };
      setCreated(next);
      await selectRestaurantContext(next.restaurantId);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("addRestaurant.errCreate"));
    } finally {
      setPending(false);
    }
  }

  async function handleSaveAndTestPos() {
    if (!created) return;
    const org = posOrganizationId.trim();
    const token = posApiToken.trim();
    const terminal = posTerminalGroupId.trim();
    const menuId = externalMenuId.trim();
    if (!org || !token || !terminal || !menuId) {
      setError(t("addRestaurant.errPosFieldsRequired"));
      return;
    }
    setPending(true);
    setError(null);
    setPosTestOk(false);
    try {
      const patchRes = await fetch(
        `/api/settings/locations/${encodeURIComponent(created.locationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            posOrganizationId: org,
            posApiToken: token,
            posTerminalGroupId: terminal,
            externalMenuId: menuId,
          }),
        },
      );
      if (!patchRes.ok) {
        throw new Error(
          await readErrorMessage(patchRes, t("addRestaurant.errSavePos")),
        );
      }

      const testRes = await fetch(
        `/api/settings/locations/${encodeURIComponent(created.locationId)}/pos-test`,
        { method: "POST" },
      );
      if (!testRes.ok) {
        throw new Error(
          await readErrorMessage(testRes, t("addRestaurant.errPosTest")),
        );
      }
      setPosTestOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("addRestaurant.errPosTest"));
      setPosTestOk(false);
    } finally {
      setPending(false);
    }
  }

  async function handleSyncTables() {
    if (!created) return;
    setPending(true);
    setError(null);
    setTablesOk(false);
    setTablesSummary(null);
    try {
      const res = await fetch("/api/settings/tables-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: created.locationId }),
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, t("addRestaurant.errTablesSync")),
        );
      }
      const data = (await res.json()) as {
        tablesCount?: number;
        tablesCreated?: number;
        tablesUpdated?: number;
        sectionsCount?: number;
        message?: string;
      };
      setTablesSummary(
        t("addRestaurant.tablesSuccess", {
          tables: String(data.tablesCount ?? 0),
          created: String(data.tablesCreated ?? 0),
          updated: String(data.tablesUpdated ?? 0),
          sections: String(data.sectionsCount ?? 0),
        }),
      );
      setTablesOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("addRestaurant.errTablesSync"));
    } finally {
      setPending(false);
    }
  }

  async function handleSyncMenu() {
    if (!created) return;
    setPending(true);
    setError(null);
    setMenuOk(false);
    setMenuSummary(null);
    try {
      const previewRes = await fetch(
        `/api/settings/menu-v3-merge/${encodeURIComponent(created.locationId)}/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalMenuId: externalMenuId.trim() || undefined,
          }),
        },
      );
      if (!previewRes.ok) {
        throw new Error(
          await readErrorMessage(previewRes, t("addRestaurant.errMenuPreview")),
        );
      }
      const preview = (await previewRes.json()) as MenuV3PreviewResponse;
      const actions = buildImportActions(preview);
      if (actions.length === 0) {
        setMenuSummary(t("addRestaurant.menuNothingToImport"));
        setMenuOk(true);
        return;
      }

      const applyRes = await fetch(
        `/api/settings/menu-v3-merge/${encodeURIComponent(created.locationId)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actions }),
        },
      );
      if (!applyRes.ok) {
        throw new Error(
          await readErrorMessage(applyRes, t("addRestaurant.errMenuApply")),
        );
      }
      const applied = (await applyRes.json()) as {
        createdCategories?: number;
        createdItems?: number;
        errors?: Array<{ message?: string }>;
      };
      const errCount = applied.errors?.length ?? 0;
      setMenuSummary(
        t("addRestaurant.menuSuccess", {
          categories: String(applied.createdCategories ?? 0),
          items: String(applied.createdItems ?? 0),
          errors: String(errCount),
        }),
      );
      if (errCount > 0 && (applied.createdCategories ?? 0) + (applied.createdItems ?? 0) === 0) {
        setError(applied.errors?.[0]?.message ?? t("addRestaurant.errMenuApply"));
        setMenuOk(false);
      } else {
        setMenuOk(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("addRestaurant.errMenuApply"));
    } finally {
      setPending(false);
    }
  }

  async function handleDone() {
    if (created) {
      await selectRestaurantContext(created.restaurantId);
    }
    onClose();
    router.push("/global-menu/unassigned");
    router.refresh();
  }

  const stepTitle =
    step === 1
      ? t("addRestaurant.step1Title")
      : step === 2
        ? t("addRestaurant.step2Title")
        : step === 3
          ? t("addRestaurant.step3Title")
          : t("addRestaurant.step4Title");

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 z-0 cursor-pointer bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={() => {
          if (pending) return;
          onClose();
        }}
      />
      <div className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-restaurant-wizard-title"
          className="flex w-full max-w-lg flex-col rounded-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md"
        >
          <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
                  {t("addRestaurant.progress", { step: String(step), total: "4" })}
                </p>
                <h2
                  id="add-restaurant-wizard-title"
                  className="mt-1 text-lg font-semibold tracking-tight text-foreground"
                >
                  {stepTitle}
                </h2>
                {created ? (
                  <p className="mt-1 truncate text-sm text-foreground/60">
                    {created.restaurantName}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={onClose}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-foreground/15 text-foreground hover:bg-foreground/5 disabled:opacity-60"
                aria-label={t("common.close")}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-5">
            {error ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            {step === 1 ? (
              <label className="block space-y-1.5">
                <span className="text-sm text-foreground/70">
                  {t("addRestaurant.nameLabel")}
                </span>
                <input
                  className={inputClassName}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("addRestaurant.namePlaceholder")}
                  autoFocus
                  disabled={pending}
                />
                <span className="block text-xs text-foreground/45">
                  {t("addRestaurant.nameHint")}
                </span>
              </label>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-sm text-foreground/70">
                    {t("restaurants.newWizard.posOrganizationId")}
                  </span>
                  <input
                    className={inputClassName}
                    value={posOrganizationId}
                    onChange={(e) => {
                      setPosOrganizationId(e.target.value);
                      setPosTestOk(false);
                    }}
                    disabled={pending}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm text-foreground/70">
                    {t("restaurants.newWizard.posApiToken")}
                  </span>
                  <input
                    className={inputClassName}
                    value={posApiToken}
                    onChange={(e) => {
                      setPosApiToken(e.target.value);
                      setPosTestOk(false);
                    }}
                    disabled={pending}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm text-foreground/70">
                    {t("addRestaurant.posTerminalGroupId")}
                  </span>
                  <input
                    className={inputClassName}
                    value={posTerminalGroupId}
                    onChange={(e) => {
                      setPosTerminalGroupId(e.target.value);
                      setPosTestOk(false);
                    }}
                    disabled={pending}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm text-foreground/70">
                    {t("menuMerge.externalMenuId")}
                  </span>
                  <input
                    className={inputClassName}
                    value={externalMenuId}
                    onChange={(e) => {
                      setExternalMenuId(e.target.value);
                      setPosTestOk(false);
                    }}
                    disabled={pending}
                  />
                </label>
                {posTestOk ? (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                    {t("addRestaurant.posTestOk")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground/65">
                  {t("addRestaurant.tablesHelp")}
                </p>
                {tablesSummary ? (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                    {tablesSummary}
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground/65">
                  {t("addRestaurant.menuHelp")}
                </p>
                {menuSummary ? (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                    {menuSummary}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-foreground/10 px-4 py-4 sm:px-5">
            {step === 1 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void handleCreate()}
                className="min-h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? t("addRestaurant.creating") : t("addRestaurant.createAndContinue")}
              </button>
            ) : null}

            {step === 2 ? (
              posTestOk ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setStep(3);
                  }}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {t("addRestaurant.next")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleSaveAndTestPos()}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? t("addRestaurant.testingPos") : t("addRestaurant.testPos")}
                </button>
              )
            ) : null}

            {step === 3 ? (
              tablesOk ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setStep(4);
                  }}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {t("addRestaurant.next")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleSyncTables()}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pending
                    ? t("addRestaurant.syncingTables")
                    : t("addRestaurant.syncTables")}
                </button>
              )
            ) : null}

            {step === 4 ? (
              menuOk ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleDone()}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {t("addRestaurant.doneUnassigned")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleSyncMenu()}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? t("addRestaurant.syncingMenu") : t("addRestaurant.syncMenu")}
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
