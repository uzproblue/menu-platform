"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { CategoryNameModal } from "@/app/components/global-menu/category-name-modal";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { getMaxUploadSizeBytes } from "@/lib/r2-upload-shared";
import type {
  Category,
  CategoriesResponse,
  GetLocationResponse,
  GlobalMenuItemApi,
  GlobalMenuResponse,
  UpdateLocationDetailsResponse,
} from "@/lib/auth-api";
import { useI18n } from "../i18n-provider";
import {
  LocationWizardMenuPreview,
  type MenuPreviewSection,
} from "./location-wizard-menu-preview";
import {
  buildSelectedItemsForAllMenuItems,
  computeOverrideFromRow,
  findMenuItemInGlobalMenu,
  getMatchingCatalogPrices,
  createDefaultItemRow,
  reconcileItemRow,
} from "./location-wizard/pricing";
import { DEFAULT_LOCATION_TRANSLATION_SELECTION } from "@/lib/menu-translation-langs";
import type { NewLocationWizardProps, SelectedItemRow } from "./location-wizard/types";
import { WizardStepBasics } from "./location-wizard/wizard-step-basics";
import { WizardStepCategories } from "./location-wizard/wizard-step-categories";
import { WizardStepDone } from "./location-wizard/wizard-step-done";
import { WizardStepMenu } from "./location-wizard/wizard-step-menu";
import { buildLocationMenuPublicUrl } from "@/lib/location-menu-url";
import { WizardStepsNav } from "./location-wizard/wizard-steps-nav";

export type { NewLocationWizardProps };

export function NewLocationWizard({
  initialLocationId = null,
}: NewLocationWizardProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("UZS");
  const [translationLangs, setTranslationLangs] = useState<string[]>([
    ...DEFAULT_LOCATION_TRANSLATION_SELECTION,
  ]);
  const logoUrlInputId = useId();
  const logoFileInputId = useId();
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImageError, setLogoImageError] = useState<string | null>(null);
  const [posOrganizationId, setPosOrganizationId] = useState("");
  const [posTerminalGroupId, setPosTerminalGroupId] = useState("");
  const [chefAlertChatId, setChefAlertChatId] = useState("");
  const maxLogoImageSizeBytes = useMemo(
    () => getMaxUploadSizeBytes("location-logo"),
    [],
  );
  const logoPreviewSrc = logoPreviewUrl ?? logoUrlInput.trim();

  const [categoriesPayload, setCategoriesPayload] =
    useState<CategoriesResponse | null>(null);
  const [globalMenu, setGlobalMenu] = useState<GlobalMenuResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [categoriesLoadError, setCategoriesLoadError] = useState<string | null>(
    null,
  );
  const [menuLoadError, setMenuLoadError] = useState<string | null>(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItemRow>>(
    {},
  );

  const [publishedLocationId, setPublishedLocationId] = useState<string | null>(
    null,
  );
  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [publicMenuUrl, setPublicMenuUrl] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [isSavingStep1, setIsSavingStep1] = useState(false);
  const [isSavingStep2, setIsSavingStep2] = useState(false);
  const [isLoadingLocationEdit, setIsLoadingLocationEdit] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);

  const trimmedInitialLocationId = initialLocationId?.trim() ?? "";
  const isEditRouteMode = Boolean(trimmedInitialLocationId);
  const wizardBackHref = isEditRouteMode
    ? `/restaurants/${encodeURIComponent(trimmedInitialLocationId)}`
    : "/restaurants";
  const wizardBackLabel = isEditRouteMode
    ? t("common.back")
    : t("restaurants.newWizard.backToList");

  useEffect(() => {
    const id = initialLocationId?.trim();
    if (!id) return;
    let cancelled = false;
    (async () => {
      setIsLoadingLocationEdit(true);
      setEditLoadError(null);
      try {
        const res = await fetch(
          `/api/settings/locations/${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (res.status === 401) {
          setEditLoadError(t("restaurants.newWizard.errLoadLocationUnauthorized"));
          return;
        }
        if (res.status === 404) {
          setEditLoadError(t("restaurants.newWizard.errLoadLocationNotFound"));
          return;
        }
        if (!res.ok) {
          setEditLoadError(t("restaurants.newWizard.errLoadLocationEdit"));
          return;
        }
        const data = (await res.json()) as GetLocationResponse;
        const loc = data.location;
        if (cancelled) return;
        setName(loc.name);
        setAddress(loc.address ?? "");
        setCurrency(loc.currency);
        setTranslationLangs(
          Array.isArray(loc.translationLangs) && loc.translationLangs.length > 0
            ? loc.translationLangs
            : [...DEFAULT_LOCATION_TRANSLATION_SELECTION],
        );
        setLogoUrlInput(loc.logoUrl ?? "");
        setPosOrganizationId(loc.posOrganizationId ?? "");
        setPosTerminalGroupId(loc.posTerminalGroupId ?? "");
        setChefAlertChatId(loc.chefAlertChatId ?? "");
        setLogoFile(null);
        setLogoPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setLogoImageError(null);
        setCreatedLocationId(loc.id);
        setSelectedCategoryIds(
          loc.enabledCategoryIds?.length ? [...loc.enabledCategoryIds] : [],
        );
      } catch {
        if (!cancelled) {
          setEditLoadError(t("restaurants.newWizard.errLoadLocationEdit"));
        }
      } finally {
        if (!cancelled) setIsLoadingLocationEdit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialLocationId, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      setCategoriesLoadError(null);
      setMenuLoadError(null);
      try {
        const [cRes, mRes] = await Promise.all([
          fetch("/api/settings/categories", { cache: "no-store" }),
          fetch("/api/settings/global-menu", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (cRes.ok) {
          setCategoriesPayload((await cRes.json()) as CategoriesResponse);
        } else {
          setCategoriesPayload(null);
          setCategoriesLoadError(
            cRes.status === 401
              ? t("restaurants.newWizard.catalogUnauthorized")
              : t("restaurants.newWizard.categoriesLoadFailed"),
          );
        }
        if (mRes.ok) {
          setGlobalMenu((await mRes.json()) as GlobalMenuResponse);
        } else {
          setGlobalMenu(null);
          setMenuLoadError(
            mRes.status === 401
              ? t("restaurants.newWizard.catalogUnauthorized")
              : t("restaurants.newWizard.menuLoadFailed"),
          );
        }
      } catch {
        if (!cancelled) {
          setCategoriesLoadError(t("restaurants.newWizard.categoriesLoadFailed"));
          setMenuLoadError(t("restaurants.newWizard.menuLoadFailed"));
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const reloadCategories = useCallback(async () => {
    try {
      const cRes = await fetch("/api/settings/categories", { cache: "no-store" });
      if (cRes.ok) {
        setCategoriesPayload((await cRes.json()) as CategoriesResponse);
        setCategoriesLoadError(null);
        return true;
      }
      setCategoriesLoadError(
        cRes.status === 401
          ? t("restaurants.newWizard.catalogUnauthorized")
          : t("restaurants.newWizard.categoriesLoadFailed"),
      );
      return false;
    } catch {
      setCategoriesLoadError(t("restaurants.newWizard.categoriesLoadFailed"));
      return false;
    }
  }, [t]);

  const allCategories = useMemo((): Category[] => {
    const fromApi = categoriesPayload?.categories ?? [];
    return [...fromApi].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }, [categoriesPayload]);

  // Edit-mode prefill (`loc.enabledCategoryIds`) can include ids for categories
  // that no longer exist in the catalog (deleted, or revoked from the
  // restaurant). Those ids are invisible in the step-2 UI because it only
  // renders rows from `allCategories`, but they remain in `selectedCategoryIds`
  // and trip the click-time validation in `handleNextFrom2` with the
  // misleading "categories no longer available — refresh" error. Reconcile
  // silently as soon as the catalog has loaded successfully.
  useEffect(() => {
    if (catalogLoading) return;
    if (categoriesLoadError) return;
    setSelectedCategoryIds((prev) => {
      const known = new Set(allCategories.map((c) => c.id));
      const filtered = prev.filter((id) => known.has(id) && !id.startsWith("local-"));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [allCategories, catalogLoading, categoriesLoadError]);

  const handleCreateCategorySave = useCallback(
    async (payload: { name: string; description?: string; coverPhoto?: string }) => {
      setIsCreatingCategory(true);
      try {
        const res = await fetch("/api/settings/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name,
            description: payload.description,
            coverPhoto: payload.coverPhoto,
          }),
        });
        if (!res.ok) {
          const msg = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(msg?.message ?? t("newCategory.createFailed"));
        }
        const body = (await res.json()) as { category?: { id?: string } };
        const newId = body.category?.id;
        await reloadCategories();
        if (newId) {
          setSelectedCategoryIds((prev) =>
            prev.includes(newId) ? prev : [...prev, newId],
          );
        }
        setCreateCategoryModalOpen(false);
      } finally {
        setIsCreatingCategory(false);
      }
    },
    [reloadCategories, t],
  );

  useEffect(() => {
    return () => {
      if (logoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const toggleCategory = useCallback((id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleItem = useCallback(
    (categoryId: string, item: GlobalMenuItemApi) => {
      setSelectedItems((prev) => {
        const next = { ...prev };
        if (next[item.id]) {
          delete next[item.id];
          return next;
        }
        next[item.id] = createDefaultItemRow(categoryId, item, currency);
        return next;
      });
    },
    [currency],
  );

  const patchItemPrice = useCallback(
    (itemId: string, item: GlobalMenuItemApi, patch: Partial<SelectedItemRow>) => {
      setSelectedItems((prev) => {
        const row = prev[itemId];
        if (!row) return prev;
        const m = getMatchingCatalogPrices(item, currency);
        const merged = { ...row, ...patch };
        return {
          ...prev,
          [itemId]: {
            ...merged,
            overridePrice: computeOverrideFromRow(merged, m),
          },
        };
      });
    },
    [currency],
  );

  const setCategoryItemsSelected = useCallback(
    (catId: string, items: GlobalMenuItemApi[], selectAll: boolean) => {
      setSelectedItems((prev) => {
        const next = { ...prev };
        if (selectAll) {
          for (const item of items) {
            if (item.active === false) continue;
            const prevRow = prev[item.id];
            next[item.id] = prevRow
              ? reconcileItemRow(
                  { ...prevRow, categoryId: catId, name: item.name },
                  item,
                  currency,
                )
              : createDefaultItemRow(catId, item, currency);
          }
        } else {
          for (const item of items) {
            delete next[item.id];
          }
        }
        return next;
      });
    },
    [currency],
  );

  const handleNextFrom1 = async () => {
    setStepError(null);
    if (!name.trim()) {
      setStepError(t("restaurants.newWizard.errNameRequired"));
      return;
    }
    if (createdLocationId) {
      setIsSavingStep1(true);
      try {
        let uploadedLogoUrl: string | undefined;
        if (logoFile) {
          uploadedLogoUrl = await uploadFileToR2(logoFile, "location-logo");
        }
        const trimmedAddress = address.trim();
        const logoForPatch = uploadedLogoUrl ?? logoUrlInput.trim();
        const res = await fetch(
          `/api/settings/locations/${encodeURIComponent(createdLocationId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              currency: currency.trim().toUpperCase(),
              address: trimmedAddress.length ? trimmedAddress : null,
              logoUrl: logoForPatch,
              translationLangs,
              posOrganizationId: posOrganizationId.trim() || null,
              posTerminalGroupId: posTerminalGroupId.trim() || null,
              chefAlertChatId: chefAlertChatId.trim() || null,
            }),
          },
        );
        if (!res.ok) {
          setStepError(t("restaurants.newWizard.errUpdateLocation"));
          return;
        }
        const payload = (await res.json()) as UpdateLocationDetailsResponse;
        const loc = payload.location;
        setName(loc.name);
        setAddress(loc.address ?? "");
        setCurrency(loc.currency);
        setTranslationLangs(
          Array.isArray(loc.translationLangs) && loc.translationLangs.length > 0
            ? loc.translationLangs
            : [...DEFAULT_LOCATION_TRANSLATION_SELECTION],
        );
        setLogoUrlInput(loc.logoUrl ?? "");
        setPosOrganizationId(loc.posOrganizationId ?? "");
        setPosTerminalGroupId(loc.posTerminalGroupId ?? "");
        setChefAlertChatId(loc.chefAlertChatId ?? "");
        setLogoFile(null);
        setLogoPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setStep(2);
      } catch {
        setStepError(t("restaurants.newWizard.errUpdateLocation"));
      } finally {
        setIsSavingStep1(false);
      }
      return;
    }

    setIsSavingStep1(true);
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        logoUrl = await uploadFileToR2(logoFile, "location-logo");
      } else {
        const trimmedLogo = logoUrlInput.trim();
        if (trimmedLogo) logoUrl = trimmedLogo;
      }
      const trimmedAddress = address.trim();
      const body: Record<string, string> = {
        name: name.trim(),
        currency: currency.trim().toUpperCase(),
      };
      const bodyWithLangs: Record<string, unknown> = {
        ...body,
        translationLangs,
      };
      if (logoUrl) bodyWithLangs.logoUrl = logoUrl;
      if (trimmedAddress) bodyWithLangs.address = trimmedAddress;

      const res = await fetch("/api/settings/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyWithLangs),
      });
      if (!res.ok) {
        setStepError(t("restaurants.newWizard.errCreateLocation"));
        return;
      }
      const payload = (await res.json()) as { location?: { id?: string } };
      const id = payload.location?.id;
      if (!id) {
        setStepError(t("restaurants.newWizard.errCreateLocation"));
        return;
      }
      setCreatedLocationId(id);
      setStep(2);
    } catch {
      setStepError(t("restaurants.newWizard.errCreateLocation"));
    } finally {
      setIsSavingStep1(false);
    }
  };

  const handleNextFrom2 = async () => {
    setStepError(null);
    if (selectedCategoryIds.length === 0) {
      setStepError(t("restaurants.newWizard.errCategoriesRequired"));
      return;
    }
    if (!createdLocationId) {
      setStepError(t("restaurants.newWizard.errCompleteBasicsFirst"));
      return;
    }

    const knownIds = new Set(allCategories.map((c) => c.id));
    const categoryIds = selectedCategoryIds.filter(
      (id) => knownIds.has(id) && !id.startsWith("local-"),
    );
    if (categoryIds.length !== selectedCategoryIds.length) {
      setStepError(t("restaurants.newWizard.errCategoriesInvalid"));
      return;
    }

    setIsSavingStep2(true);
    try {
      const res = await fetch(
        `/api/settings/locations/${encodeURIComponent(createdLocationId)}/categories`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryIds }),
        },
      );
      if (!res.ok) {
        setStepError(t("restaurants.newWizard.errSaveCategories"));
        return;
      }
      setSelectedItems(
        buildSelectedItemsForAllMenuItems(
          selectedCategoryIds,
          globalMenu,
          currency,
        ),
      );
      setStep(3);
    } catch {
      setStepError(t("restaurants.newWizard.errSaveCategories"));
    } finally {
      setIsSavingStep2(false);
    }
  };

  const handlePublish = async () => {
    setStepError(null);
    const count = Object.keys(selectedItems).length;
    if (count === 0) {
      setStepError(t("restaurants.newWizard.errItemsRequired"));
      return;
    }
    if (!createdLocationId) {
      setStepError(t("restaurants.newWizard.errCompleteBasicsFirst"));
      return;
    }
    setPublishing(true);
    try {
      const items: { menuItemId: string; price: string }[] = [];
      for (const [menuItemId, row] of Object.entries(selectedItems)) {
        const catalogItem = findMenuItemInGlobalMenu(globalMenu, menuItemId);
        if (!catalogItem) {
          setStepError(t("restaurants.newWizard.errPublishMenuCatalogMissing"));
          return;
        }
        const matching = getMatchingCatalogPrices(catalogItem, currency);
        const amount = computeOverrideFromRow(row, matching).trim();
        if (!amount.length) {
          setStepError(t("restaurants.newWizard.errItemsPriceInvalid"));
          return;
        }
        items.push({ menuItemId, price: amount });
      }

      const res = await fetch(
        `/api/settings/locations/${encodeURIComponent(createdLocationId)}/menu-items`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const errBody = (await res.json()) as { message?: string };
          if (typeof errBody?.message === "string" && errBody.message.trim()) {
            detail = errBody.message.trim();
          }
        } catch {
          /* ignore */
        }
        setStepError(
          detail
            ? t("restaurants.newWizard.errPublishLocationMenuWithDetail", { detail })
            : t("restaurants.newWizard.errPublishLocationMenu"),
        );
        return;
      }

      setPublishedLocationId(createdLocationId);
      setStep(4);

      void fetch("/api/settings/global-menu", { cache: "no-store" }).then(async (mRes) => {
        if (mRes.ok) {
          try {
            setGlobalMenu((await mRes.json()) as GlobalMenuResponse);
          } catch {
            /* ignore */
          }
        }
      });
    } catch {
      setStepError(t("restaurants.newWizard.publishFailed"));
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (step !== 4 || !publishedLocationId) {
      setQrDataUrl(null);
      return;
    }
    const menuUrl = buildLocationMenuPublicUrl(publishedLocationId);
    setPublicMenuUrl(menuUrl);
    let cancelled = false;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(menuUrl, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [step, publishedLocationId]);

  const downloadQr = useCallback(() => {
    if (!qrDataUrl || !publishedLocationId) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-code-${publishedLocationId}.png`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [qrDataUrl, publishedLocationId]);

  const selectedSet = useMemo(
    () => new Set(selectedCategoryIds),
    [selectedCategoryIds],
  );

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, GlobalMenuItemApi[]>();
    if (!globalMenu) return map;
    for (const cat of globalMenu.categories) {
      if (selectedSet.has(cat.id)) {
        map.set(cat.id, cat.items.filter((i) => i.active !== false));
      }
    }
    return map;
  }, [globalMenu, selectedSet]);

  const menuPreviewSections = useMemo((): MenuPreviewSection[] => {
    const out: MenuPreviewSection[] = [];
    for (const catId of selectedCategoryIds) {
      const meta = allCategories.find((c) => c.id === catId);
      if (!meta) continue;
      const items: { name: string; price: string }[] = [];
      for (const row of Object.values(selectedItems)) {
        if (row.categoryId !== catId) continue;
        items.push({
          name: row.name,
          price: `${row.overridePrice} ${currency}`.trim(),
        });
      }
      out.push({ categoryName: meta.name, items });
    }
    return out;
  }, [selectedCategoryIds, allCategories, selectedItems, currency]);

  const steps = [
    { n: 1 as const, label: t("restaurants.newWizard.stepBasics") },
    { n: 2 as const, label: t("restaurants.newWizard.stepCategories") },
    { n: 3 as const, label: t("restaurants.newWizard.stepMenu") },
    { n: 4 as const, label: t("restaurants.newWizard.stepDone") },
  ];

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:items-start lg:gap-10 xl:gap-12">
      <div className="min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isEditRouteMode
                ? t("restaurants.newWizard.editPageTitle")
                : t("restaurants.newWizard.pageTitle")}
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              {isEditRouteMode
                ? t("restaurants.newWizard.editPageSubtitle")
                : t("restaurants.newWizard.pageSubtitle")}
            </p>
          </div>
          <Link
            href={wizardBackHref}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-foreground/15 bg-background/80 px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-foreground/25 hover:bg-foreground/5"
          >
            {wizardBackLabel}
          </Link>
        </div>

        <WizardStepsNav step={step} steps={steps} ariaLabel={t("restaurants.newWizard.stepsNav")} />

        {stepError && (
          <p
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
            role="alert"
          >
            {stepError}
          </p>
        )}

        {step === 1 && (
          <WizardStepBasics
            name={name}
            setName={setName}
            address={address}
            setAddress={setAddress}
            currency={currency}
            setCurrency={setCurrency}
            translationLangs={translationLangs}
            setTranslationLangs={setTranslationLangs}
            logoUrlInputId={logoUrlInputId}
            logoFileInputId={logoFileInputId}
            logoUrlInput={logoUrlInput}
            setLogoUrlInput={setLogoUrlInput}
            logoPreviewSrc={logoPreviewSrc}
            logoFile={logoFile}
            setLogoFile={setLogoFile}
            setLogoPreviewUrl={setLogoPreviewUrl}
            logoImageError={logoImageError}
            setLogoImageError={setLogoImageError}
            maxLogoImageSizeBytes={maxLogoImageSizeBytes}
            posOrganizationId={posOrganizationId}
            setPosOrganizationId={setPosOrganizationId}
            posTerminalGroupId={posTerminalGroupId}
            setPosTerminalGroupId={setPosTerminalGroupId}
            chefAlertChatId={chefAlertChatId}
            setChefAlertChatId={setChefAlertChatId}
            isLoadingLocationEdit={isLoadingLocationEdit}
            editLoadError={editLoadError}
            isSavingStep1={isSavingStep1}
            createdLocationId={createdLocationId}
            onNext={handleNextFrom1}
          />
        )}

        {step === 2 && (
          <WizardStepCategories
            catalogLoading={catalogLoading}
            categoriesLoadError={categoriesLoadError}
            allCategories={allCategories}
            selectedCategoryIds={selectedCategoryIds}
            toggleCategory={toggleCategory}
            onOpenCreateCategory={() => setCreateCategoryModalOpen(true)}
            isSavingStep2={isSavingStep2}
            onBack={() => {
              setStep(1);
              setStepError(null);
            }}
            onNext={handleNextFrom2}
          />
        )}

        {step === 3 && (
          <WizardStepMenu
            menuLoadError={menuLoadError}
            selectedCategoryIds={selectedCategoryIds}
            allCategories={allCategories}
            itemsByCategory={itemsByCategory}
            currency={currency}
            selectedItems={selectedItems}
            toggleItem={toggleItem}
            setCategoryItemsSelected={setCategoryItemsSelected}
            patchItemPrice={patchItemPrice}
            publishing={publishing}
            onBack={() => {
              setStep(2);
              setStepError(null);
            }}
            onPublish={handlePublish}
          />
        )}

        {step === 4 && publishedLocationId && (
          <WizardStepDone
            publishedLocationId={publishedLocationId}
            qrDataUrl={qrDataUrl}
            publicMenuUrl={publicMenuUrl}
            onDownloadQr={downloadQr}
          />
        )}
      </div>

      <aside className="mt-10 hidden lg:mt-0 lg:flex lg:justify-center xl:sticky xl:top-24 xl:justify-end xl:self-start">
        <LocationWizardMenuPreview
          locationName={name}
          address={address}
          currency={currency}
          logoSrc={logoPreviewSrc || undefined}
          sections={menuPreviewSections}
          placeholderLocationName={t("restaurants.newWizard.previewPlaceholderName")}
          caption={t("restaurants.newWizard.menuPreviewCaption")}
        />
      </aside>

      <CategoryNameModal
        open={createCategoryModalOpen}
        mode="create"
        initialName=""
        initialDescription=""
        initialCoverPhoto=""
        isSaving={isCreatingCategory}
        onClose={() => {
          if (!isCreatingCategory) setCreateCategoryModalOpen(false);
        }}
        onSave={handleCreateCategorySave}
      />
    </div>
  );
}
