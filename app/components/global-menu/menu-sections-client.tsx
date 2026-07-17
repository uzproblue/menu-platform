"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import type { TranslationTextApi } from "@/lib/auth-api";
import type { MenuSectionEntity } from "@/lib/data/global-menu-types";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import { readLocationExportWarning } from "@/lib/location-export-warning";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { useI18n } from "../i18n-provider";
import {
  CatalogImageField,
  type CatalogImageFieldValue,
} from "./catalog-image-field";
import { SectionTranslationsModal } from "./section-translations-modal";

const EMPTY_SECTION_TRANSLATIONS: TranslationTextApi[] = [];

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | null;
  return payload?.message ?? fallback;
}

function sectionDisplayName(
  section: MenuSectionEntity,
  unassignedLabel: string,
): string {
  return section.kind === "unassigned" ? unassignedLabel : section.name;
}

function normalizeSections(list: MenuSectionEntity[]): MenuSectionEntity[] {
  return [...list]
    .map((s) => ({
      ...s,
      translations: Array.isArray(s.translations) ? s.translations : [],
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

type SectionEditorState =
  | { mode: "create" }
  | { mode: "edit"; section: MenuSectionEntity }
  | null;

type SortableSectionRowProps = {
  section: MenuSectionEntity;
  name: string;
  countLabel: string;
  reordering: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenTranslations: () => void;
  translationsLabel: string;
  translationsAria: string;
  dragHandleAria: string;
  editLabel: string;
  deleteLabel: string;
  standardLabel: string;
  noImageLabel: string;
};

function SortableSectionRow({
  section,
  name,
  countLabel,
  reordering,
  onEdit,
  onDelete,
  onOpenTranslations,
  translationsLabel,
  translationsAria,
  dragHandleAria,
  editLabel,
  deleteLabel,
  standardLabel,
  noImageLabel,
}: SortableSectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: reordering,
  });
  const count = section.categoriesCount ?? 0;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-4 ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:gap-4"
    >
      <button
        type="button"
        className="inline-flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-foreground/15 text-foreground/70 hover:bg-foreground/5 disabled:opacity-40"
        aria-label={dragHandleAria}
        disabled={reordering}
        {...attributes}
        {...listeners}
      >
        <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M8 7h2v2H8V7zm6 0h2v2h-2V7zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 4h2v2H8v-2zm6 0h2v2h-2v-2z" />
        </svg>
      </button>
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5">
        {section.backgroundImage ? (
          <Image
            src={section.backgroundImage}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
            unoptimized={imageSrcIsNonOptimizable(section.backgroundImage)}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-foreground/40">
            {noImageLabel}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="mt-0.5 text-xs text-foreground/55">
          {standardLabel}
          {" · "}
          {count} {countLabel}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenTranslations}
          disabled={reordering}
          className="inline-flex min-h-10 items-center rounded-xl border border-foreground/15 px-3 text-sm font-medium text-foreground hover:bg-foreground/5 disabled:opacity-40"
          aria-label={translationsAria}
        >
          {translationsLabel}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={reordering}
          className="inline-flex min-h-10 items-center rounded-xl border border-foreground/15 px-3 text-sm font-medium text-foreground hover:bg-foreground/5 disabled:opacity-40"
        >
          {editLabel}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={reordering}
          className="inline-flex min-h-10 items-center rounded-xl border border-red-500/30 px-3 text-sm font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-40 dark:text-red-300"
        >
          {deleteLabel}
        </button>
      </div>
    </li>
  );
}

export function MenuSectionsClient() {
  const { t } = useI18n();
  const [sections, setSections] = useState<MenuSectionEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [editor, setEditor] = useState<SectionEditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuSectionEntity | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [translationsModalSection, setTranslationsModalSection] =
    useState<MenuSectionEntity | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadSections = useCallback(async () => {
    setLoadError(null);
    const response = await fetch("/api/settings/menu-sections", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, t("sections.errLoad")));
    }
    const payload = (await response.json()) as {
      sections?: MenuSectionEntity[];
    };
    const list = Array.isArray(payload.sections) ? payload.sections : [];
    setSections(normalizeSections(list));
  }, [t]);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        await loadSections();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : t("sections.errLoadNetwork"));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadSections, t]);

  const visibleSections = useMemo(() => {
    return sections.filter(
      (s) => s.kind === "standard" || (s.kind === "unassigned" && (s.categoriesCount ?? 0) > 0),
    );
  }, [sections]);

  const standardSections = useMemo(
    () => visibleSections.filter((s) => s.kind === "standard"),
    [visibleSections],
  );

  const unassignedSection = useMemo(
    () => visibleSections.find((s) => s.kind === "unassigned") ?? null,
    [visibleSections],
  );

  const persistReorder = useCallback(
    async (nextIds: string[]) => {
      setReordering(true);
      setRequestError(null);
      setExportWarning(null);
      try {
        const response = await fetch("/api/settings/menu-sections/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionIds: nextIds }),
        });
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, t("sections.errReorder")));
        }
        const payload = (await response.json().catch(() => null)) as
          | ({ sections?: MenuSectionEntity[] } & Record<string, unknown>)
          | null;
        setExportWarning(readLocationExportWarning(payload, t));
        if (Array.isArray(payload?.sections)) {
          setSections(normalizeSections(payload.sections));
        } else {
          await loadSections();
        }
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : t("sections.errReorder"));
        await loadSections();
      } finally {
        setReordering(false);
      }
    },
    [loadSections, t],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reordering) return;
    const ids = standardSections.map((s) => s.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const nextIds = arrayMove(ids, oldIndex, newIndex);
    setSections((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      const nextStandard = nextIds
        .map((id, index) => {
          const row = byId.get(id);
          return row ? { ...row, sortOrder: index } : null;
        })
        .filter((s): s is MenuSectionEntity => s != null);
      const rest = prev.filter((s) => s.kind !== "standard");
      return normalizeSections([...nextStandard, ...rest]);
    });
    void persistReorder(nextIds);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setRequestError(null);
    setExportWarning(null);
    try {
      const response = await fetch(
        `/api/settings/menu-sections/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, t("sections.errDelete")));
      }
      setDeleteTarget(null);
      await loadSections();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : t("sections.errDelete"));
    } finally {
      setDeletingId(null);
    }
  }

  const handleTranslationsSaved = useCallback(
    (payload: Record<string, unknown> | null) => {
      setExportWarning(readLocationExportWarning(payload, t));
      const sectionPayload =
        payload && typeof payload === "object" && "section" in payload
          ? (payload.section as MenuSectionEntity | undefined)
          : undefined;
      if (sectionPayload && typeof sectionPayload.id === "string") {
        const translations = Array.isArray(sectionPayload.translations)
          ? sectionPayload.translations
          : [];
        setSections((prev) =>
          prev.map((s) =>
            s.id === sectionPayload.id
              ? {
                  ...s,
                  ...sectionPayload,
                  translations,
                }
              : s,
          ),
        );
        setTranslationsModalSection((prev) =>
          prev && prev.id === sectionPayload.id
            ? { ...prev, ...sectionPayload, translations }
            : prev,
        );
      } else {
        void loadSections();
      }
      setTranslationsModalSection(null);
    },
    [loadSections, t],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("sections.title")}
          </h1>
          <p className="mt-2 text-sm text-foreground/60">{t("sections.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditor({ mode: "create" })}
          disabled={isLoading}
          className="inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t("sections.addSection")}
        </button>
      </div>

      {requestError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {requestError}
        </div>
      ) : null}

      {exportWarning ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
        >
          <p>{exportWarning}</p>
          <button
            type="button"
            onClick={() => setExportWarning(null)}
            aria-label={t("common.close")}
            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-foreground/65 hover:bg-foreground/5"
          >
            ×
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="px-6 py-12 text-center text-sm text-foreground/70">{t("sections.loading")}</p>
      ) : loadError ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">{t("sections.couldNotLoad")}</p>
          <p className="mt-2 text-sm text-foreground/60">{loadError}</p>
        </div>
      ) : visibleSections.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">{t("sections.emptyTitle")}</p>
          <p className="mt-2 text-sm text-foreground/60">{t("sections.emptyHelp")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={standardSections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-3">
                {standardSections.map((section) => {
                  const name = sectionDisplayName(section, t("sections.unassigned"));
                  const count = section.categoriesCount ?? 0;
                  const countLabel =
                    count === 1 ? t("sections.categorySingular") : t("sections.categoryPlural");
                  return (
                    <SortableSectionRow
                      key={section.id}
                      section={section}
                      name={name}
                      countLabel={countLabel}
                      reordering={reordering}
                      onEdit={() => setEditor({ mode: "edit", section })}
                      onDelete={() => setDeleteTarget(section)}
                      onOpenTranslations={() => setTranslationsModalSection(section)}
                      translationsLabel={t("sections.translations")}
                      translationsAria={t("sections.translationsModal.openAria", { name })}
                      dragHandleAria={t("sections.dragHandleAria", { name })}
                      editLabel={t("common.edit")}
                      deleteLabel={t("common.delete")}
                      standardLabel={t("sections.standardSection")}
                      noImageLabel={t("global.noImage")}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>

          {unassignedSection ? (
            <ul className="space-y-3">
              <li className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-4 ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:gap-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 sm:ml-12">
                  {unassignedSection.backgroundImage ? (
                    <Image
                      src={unassignedSection.backgroundImage}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized={imageSrcIsNonOptimizable(unassignedSection.backgroundImage)}
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-[10px] text-foreground/40">
                      {t("global.noImage")}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {t("sections.unassigned")}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/55">
                    {t("sections.systemSection")}
                    {" · "}
                    {unassignedSection.categoriesCount ?? 0}{" "}
                    {(unassignedSection.categoriesCount ?? 0) === 1
                      ? t("sections.categorySingular")
                      : t("sections.categoryPlural")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-foreground/45">{t("sections.unassignedHint")}</span>
                </div>
              </li>
            </ul>
          ) : null}
        </div>
      )}

      <SectionEditorModal
        open={editor != null}
        mode={editor?.mode ?? "create"}
        initial={editor?.mode === "edit" ? editor.section : null}
        isSaving={isSaving}
        onClose={() => {
          if (!isSaving) setEditor(null);
        }}
        onSave={async (payload) => {
          setIsSaving(true);
          setRequestError(null);
          setExportWarning(null);
          try {
            const isEdit = editor?.mode === "edit";
            const url =
              isEdit && editor
                ? `/api/settings/menu-sections/${encodeURIComponent(editor.section.id)}`
                : "/api/settings/menu-sections";
            const response = await fetch(url, {
              method: isEdit ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (!response.ok) {
              throw new Error(
                await readErrorMessage(
                  response,
                  isEdit ? t("sections.errEdit") : t("sections.errAdd"),
                ),
              );
            }
            const successPayload = (await response.json().catch(() => null)) as
              | Record<string, unknown>
              | null;
            setExportWarning(readLocationExportWarning(successPayload, t));
            setEditor(null);
            await loadSections();
          } finally {
            setIsSaving(false);
          }
        }}
      />

      <SectionTranslationsModal
        key={translationsModalSection?.id ?? "closed"}
        open={translationsModalSection != null}
        sectionId={translationsModalSection?.id ?? null}
        sectionTitle={
          translationsModalSection
            ? sectionDisplayName(translationsModalSection, t("sections.unassigned"))
            : ""
        }
        translations={translationsModalSection?.translations ?? EMPTY_SECTION_TRANSLATIONS}
        onClose={() => setTranslationsModalSection(null)}
        onSaved={handleTranslationsSaved}
      />

      {deleteTarget ? (
        <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label={t("common.close")}
            onClick={() => setDeleteTarget(null)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-section-title"
            className="relative z-10 w-full max-w-md rounded-t-2xl border border-foreground/10 bg-background/95 p-5 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
          >
            <h2 id="delete-section-title" className="text-lg font-semibold text-foreground">
              {t("sections.deleteQuestion")}
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              {t("sections.deleteBody", { name: deleteTarget.name })}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-11 flex-1 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deletingId === deleteTarget.id}
                className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:opacity-90 dark:bg-red-700"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SectionEditorModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initial: MenuSectionEntity | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; backgroundImage?: string | null }) => Promise<void>;
};

function SectionEditorModal({
  open,
  mode,
  initial,
  isSaving,
  onClose,
  onSave,
}: SectionEditorModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const nameId = useId();
  const [name, setName] = useState("");
  const [imageValue, setImageValue] = useState<CatalogImageFieldValue>({
    url: "",
    file: null,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setImageValue({ url: initial?.backgroundImage ?? "", file: null });
    setSubmitError(null);
  }, [initial, mode, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, isSaving, onClose]);

  if (!open) return null;

  const canSave = name.trim().length > 0 && !isSaving;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSubmitError(null);
    try {
      let backgroundImage: string | null | undefined = imageValue.url.trim() || null;
      if (imageValue.file) {
        backgroundImage = await uploadFileToR2(imageValue.file, "section-background");
      }
      await onSave({ name: name.trim(), backgroundImage });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("sections.errSave"));
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={() => {
          if (!isSaving) onClose();
        }}
      />
      <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 pointer-events-none sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="pointer-events-auto max-h-[min(92vh,calc(100dvh-1rem))] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
        >
          <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
              {mode === "create" ? t("sections.createTitle") : t("sections.editTitle")}
            </h2>
            <p className="mt-1 text-xs text-foreground/55">{t("sections.editorHelp")}</p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-4 sm:px-5">
            {submitError ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {submitError}
              </div>
            ) : null}
            <div className="space-y-2">
              <label htmlFor={nameId} className="text-sm font-medium text-foreground">
                {t("common.name")}
              </label>
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                disabled={isSaving}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                autoFocus
              />
            </div>
            <CatalogImageField
              label={`${t("sections.backgroundImage")} ${t("newCategory.optionalSuffix")}`}
              value={imageValue}
              onChange={setImageValue}
              uploadTarget="section-background"
              disabled={isSaving}
            />
            <div className="flex gap-2 border-t border-foreground/10 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="min-h-11 flex-1 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="min-h-11 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? t("sections.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
