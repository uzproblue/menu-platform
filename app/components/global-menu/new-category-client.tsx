"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { TranslationTextApi } from "@/lib/auth-api";
import type { MenuSectionEntity } from "@/lib/data/global-menu-types";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import { appendCategoryMutation } from "@/lib/pending-mutations";
import {
  persistPendingLocationExportWarning,
  readLocationExportWarning,
} from "@/lib/location-export-warning";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { useI18n } from "../i18n-provider";
import {
  CatalogImageField,
  type CatalogImageFieldValue,
} from "./catalog-image-field";

type NewCategoryClientProps = {
  initialMenuSectionId?: string;
};

export function NewCategoryClient({ initialMenuSectionId = "" }: NewCategoryClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const nameId = useId();
  const menuSectionFieldId = useId();
  const descriptionId = useId();

  const [name, setName] = useState("");
  const [sections, setSections] = useState<MenuSectionEntity[]>([]);
  const [menuSectionId, setMenuSectionId] = useState(initialMenuSectionId);
  const categoriesListPath = menuSectionId
    ? `/global-menu/categories/section/${encodeURIComponent(menuSectionId)}`
    : "/global-menu/categories";
  const [description, setDescription] = useState("");
  const [imageValue, setImageValue] = useState<CatalogImageFieldValue>({
    url: "",
    file: null,
  });
  const [livePreviewUrl, setLivePreviewUrl] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/settings/menu-sections", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          sections?: MenuSectionEntity[];
        };
        const list = Array.isArray(payload.sections) ? payload.sections : [];
        setSections(list);
        setMenuSectionId((prev) => {
          if (prev && list.some((s) => s.id === prev)) return prev;
          return (
            list.find((s) => s.kind === "standard")?.id ||
            list[0]?.id ||
            ""
          );
        });
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  useEffect(() => {
    if (imageValue.file) {
      const url = URL.createObjectURL(imageValue.file);
      setLivePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setLivePreviewUrl(imageValue.url.trim());
  }, [imageValue]);

  const previewName = name.trim() || t("newCategory.previewUntitled");
  const previewDescription =
    description.trim() || t("newCategory.previewNoDescription");
  const previewPhoto = livePreviewUrl;

  const canSave = useMemo(
    () => name.trim().length > 0 && menuSectionId.trim().length > 0 && !isSaving,
    [isSaving, menuSectionId, name],
  );
  const controlsDisabled = isSaving;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim().length || !menuSectionId.trim().length || isSaving) return;

    setSubmitError(null);
    setIsSaving(true);
    try {
      let coverPhoto = imageValue.url.trim() || undefined;
      if (imageValue.file) {
        coverPhoto = await uploadFileToR2(imageValue.file, "category-cover");
      }

      const response = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          coverPhoto,
          menuSectionId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setSubmitError(payload?.message ?? t("newCategory.createFailed"));
        return;
      }

      const successPayload = (await response.json().catch(() => null)) as
        | ({
            category?: {
              id?: unknown;
              name?: unknown;
              description?: unknown;
              coverPhoto?: unknown;
              sortOrder?: unknown;
              menuSectionId?: unknown;
              itemsCount?: unknown;
              translations?: unknown;
            };
          } & Record<string, unknown>)
        | null;
      const created = successPayload?.category;
      if (
        created &&
        typeof created.id === "string" &&
        typeof created.name === "string" &&
        typeof created.sortOrder === "number" &&
        typeof created.itemsCount === "number"
      ) {
        const translations = Array.isArray(created.translations)
          ? (created.translations as TranslationTextApi[])
          : undefined;
        const resolvedSectionId =
          typeof created.menuSectionId === "string"
            ? created.menuSectionId
            : menuSectionId;
        appendCategoryMutation({
          kind: "upsert",
          value: {
            id: created.id,
            name: created.name,
            description:
              typeof created.description === "string"
                ? created.description
                : null,
            coverPhoto:
              typeof created.coverPhoto === "string"
                ? created.coverPhoto
                : null,
            sortOrder: created.sortOrder,
            menuSectionId: resolvedSectionId,
            itemsCount: created.itemsCount,
            ...(translations !== undefined ? { translations } : {}),
          },
        });
      }

      persistPendingLocationExportWarning(
        readLocationExportWarning(successPayload, t),
      );
      router.push(categoriesListPath);
    } catch {
      setSubmitError(t("newCategory.createFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <nav aria-label={t("newCategory.breadcrumbNav")}>
        <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
          {t("nav.menuCategories")}
        </p>
        <Link
          href={categoriesListPath}
          onClick={(e) => {
            if (controlsDisabled) e.preventDefault();
          }}
          aria-disabled={controlsDisabled}
          className="mt-2 inline-block text-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
        >
          {`← ${t("newCategory.back")}`}
        </Link>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-foreground/10 bg-background/60 p-6 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("newCategory.title")}
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            {t("newCategory.subtitle")}
          </p>
          {submitError ? (
            <div className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {submitError}
            </div>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                htmlFor={nameId}
                className="text-sm font-medium text-foreground"
              >
                {t("common.name")} <span className="text-red-500">*</span>
              </label>
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                disabled={controlsDisabled}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                placeholder={t("newCategory.namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor={menuSectionFieldId}
                className="text-sm font-medium text-foreground"
              >
                {t("categories.menuSection")}
              </label>
              <select
                id={menuSectionFieldId}
                value={menuSectionId}
                onChange={(e) => setMenuSectionId(e.target.value)}
                disabled={controlsDisabled || sections.length === 0}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.kind === "unassigned"
                      ? t("sections.unassigned")
                      : section.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor={descriptionId}
                className="text-sm font-medium text-foreground"
              >
                {t("global.description")}{" "}
                <span className="text-foreground/50">
                  {t("newCategory.optionalSuffix")}
                </span>
              </label>
              <textarea
                id={descriptionId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={1000}
                disabled={controlsDisabled}
                className="w-full resize-y rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                placeholder={t("newCategory.descriptionPlaceholder")}
              />
            </div>

            <CatalogImageField
              label={`${t("newCategory.coverPhoto")} ${t("newCategory.optionalSuffix")}`}
              value={imageValue}
              onChange={setImageValue}
              uploadTarget="category-cover"
              disabled={controlsDisabled}
            />

            <div className="flex flex-col-reverse gap-2 border-t border-foreground/10 pt-5 sm:flex-row sm:justify-end">
              <Link
                href={categoriesListPath}
                onClick={(e) => {
                  if (controlsDisabled) e.preventDefault();
                }}
                aria-disabled={controlsDisabled}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
              >
                {t("common.cancel")}
              </Link>
              <button
                type="submit"
                disabled={!canSave}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? t("newCategory.saving") : t("newCategory.save")}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-foreground/10 bg-background/60 p-6 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {t("newCategory.livePreviewTitle")}
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            {t("newCategory.livePreviewSubtitle")}
          </p>

          <div className="mt-4">
            <article className="group relative overflow-hidden rounded-2xl border border-foreground/10 ring-1 ring-foreground/5">
              {previewPhoto ? (
                <Image
                  src={previewPhoto}
                  alt={`${previewName} cover`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 896px"
                  priority
                  unoptimized={imageSrcIsNonOptimizable(previewPhoto)}
                />
              ) : (
                <div className="absolute inset-0 size-full bg-gradient-to-br from-foreground/15 to-foreground/5" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />
              <div className="relative flex min-h-56 items-end p-5">
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight text-white">
                    {previewName}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-white/80">
                    {previewDescription}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
