"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { useI18n } from "../i18n-provider";

export function NewCategoryClient() {
  const { t } = useI18n();
  const router = useRouter();
  const nameId = useId();
  const descriptionId = useId();
  const coverPhotoUrlId = useId();
  const coverPhotoUploadId = useId();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [localCoverPreviewUrl, setLocalCoverPreviewUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const previewName = name.trim() || t("newCategory.previewUntitled");
  const previewDescription = description.trim() || t("newCategory.previewNoDescription");
  const previewPhoto = localCoverPreviewUrl || coverPhotoUrl.trim();

  const canSave = useMemo(() => name.trim().length > 0 && !isSaving, [isSaving, name]);
  const controlsDisabled = isSaving;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim().length || isSaving) return;

    setSubmitError(null);
    setIsSaving(true);
    try {
      let coverPhoto = coverPhotoUrl.trim() || undefined;
      if (selectedCoverFile) {
        coverPhoto = await uploadFileToR2(selectedCoverFile, "category-cover");
      }

      const response = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          coverPhoto,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setSubmitError(payload?.message ?? t("newCategory.createFailed"));
        return;
      }

      router.push("/global-menu/categories");
      router.refresh();
    } catch {
      setSubmitError(t("newCategory.createFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    return () => {
      if (localCoverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(localCoverPreviewUrl);
      }
    };
  }, [localCoverPreviewUrl]);

  function clearCoverPhoto() {
    setCoverPhotoUrl("");
    setSelectedCoverFile(null);
    setLocalCoverPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <nav aria-label={t("newCategory.breadcrumbNav")}>
        <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
          {t("nav.menuCategories")}
        </p>
        <Link
          href="/global-menu/categories"
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
              <label htmlFor={nameId} className="text-sm font-medium text-foreground">
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
              <label htmlFor={descriptionId} className="text-sm font-medium text-foreground">
                {t("global.description")}{" "}
                <span className="text-foreground/50">{t("newCategory.optionalSuffix")}</span>
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("newCategory.coverPhoto")}{" "}
                <span className="text-foreground/50">{t("newCategory.optionalSuffix")}</span>
              </label>
              <div className="space-y-3 rounded-xl border border-foreground/15 bg-foreground/3 p-3">
                <div className="space-y-2">
                  <label htmlFor={coverPhotoUrlId} className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                    {t("newCategory.coverPhotoUrlLabel")}
                  </label>
                  <input
                    id={coverPhotoUrlId}
                    type="url"
                    value={coverPhotoUrl}
                    onChange={(e) => setCoverPhotoUrl(e.target.value)}
                    maxLength={500}
                    disabled={controlsDisabled}
                    className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                    placeholder={t("newCategory.coverPhotoUrlPlaceholder")}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-foreground/15" />
                  <span className="text-xs font-medium uppercase tracking-wide text-foreground/45">
                    {t("newCategory.or")}
                  </span>
                  <div className="h-px flex-1 bg-foreground/15" />
                </div>

                <div className="space-y-2">
                  <label htmlFor={coverPhotoUploadId} className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                    {t("newCategory.coverPhotoUploadLabel")}
                  </label>
                  <input
                    ref={uploadInputRef}
                    id={coverPhotoUploadId}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const nextFile = e.target.files?.[0];
                      if (!nextFile) return;
                      setSelectedCoverFile(nextFile);
                      setLocalCoverPreviewUrl((prev) => {
                        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                        return URL.createObjectURL(nextFile);
                      });
                    }}
                    disabled={controlsDisabled}
                    className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-foreground/15"
                  />
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={clearCoverPhoto}
                      disabled={controlsDisabled || (!coverPhotoUrl.trim() && !selectedCoverFile)}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-foreground/20 px-3 text-xs font-medium text-foreground hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("newCategory.clearPhoto")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-foreground/10 pt-5 sm:flex-row sm:justify-end">
              <Link
                href="/global-menu/categories"
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
                  <p className="text-lg font-semibold tracking-tight text-white">{previewName}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-white/80">{previewDescription}</p>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
