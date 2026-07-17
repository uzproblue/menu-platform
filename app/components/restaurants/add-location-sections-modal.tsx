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
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useI18n } from "../i18n-provider";

export type AvailableSection = {
  id: string;
  name: string;
  categoriesCount: number;
};

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

type AddLocationSectionsModalProps = {
  open: boolean;
  sections: AvailableSection[];
  initialSelectedIds: string[];
  saving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSave: (selectedIds: string[]) => void;
};

function SortableOrderRow({
  id,
  name,
  dragHandleAria,
  disabled,
}: {
  id: string;
  name: string;
  dragHandleAria: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-xl border border-foreground/10 px-3 py-2"
    >
      <button
        type="button"
        className="inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-foreground/15 text-foreground/70 disabled:opacity-40"
        aria-label={dragHandleAria}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M8 7h2v2H8V7zm6 0h2v2h-2V7zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 4h2v2H8v-2zm6 0h2v2h-2v-2z" />
        </svg>
      </button>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
    </li>
  );
}

export function AddLocationSectionsModal({
  open,
  sections,
  initialSelectedIds,
  saving,
  saveError,
  onClose,
  onSave,
}: AddLocationSectionsModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const hintId = useId();

  const sessionKey = useMemo(() => {
    if (!open) return "closed";
    return `${sections.map((s) => s.id).join("|")}::${initialSelectedIds.join("|")}`;
  }, [open, sections, initialSelectedIds]);

  const [keySnapshot, setKeySnapshot] = useState<string>(sessionKey);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds));
  const [order, setOrder] = useState<string[]>(() => [...initialSelectedIds]);

  if (keySnapshot !== sessionKey) {
    setKeySnapshot(sessionKey);
    setSelected(new Set(initialSelectedIds));
    setOrder([...initialSelectedIds]);
  }

  const nameById = useMemo(
    () => new Map(sections.map((s) => [s.id, s.name])),
    [sections],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const orderedSelected = order.filter((id) => selected.has(id));
  const hasChanges =
    !arraysEqual(orderedSelected, initialSelectedIds) ||
    selected.size !== initialSelectedIds.length ||
    !initialSelectedIds.every((id) => selected.has(id));
  const canSave = !saving && hasChanges;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setOrder((o) => o.filter((x) => x !== id));
      } else {
        next.add(id);
        setOrder((o) => (o.includes(id) ? o : [...o, id]));
      }
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || saving) return;
    setOrder((prev) => {
      const ids = prev.filter((id) => selected.has(id));
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(ids, oldIndex, newIndex);
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave(order.filter((id) => selected.has(id)));
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={saving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
      >
        <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
            {t("restaurantDetail.addSectionsTitle")}
          </h2>
          <p id={hintId} className="mt-1 text-xs text-foreground/55">
            {t("restaurantDetail.addSectionsHint")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
        >
          {sections.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground/55">
              {t("restaurantDetail.addSectionsEmptyCatalog")}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {sections.map((section) => {
                const checked = selected.has(section.id);
                const countLabel =
                  section.categoriesCount === 1
                    ? t("sections.categorySingular")
                    : t("sections.categoryPlural");
                return (
                  <li key={section.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ring-1 transition-colors ${
                        checked
                          ? "border-foreground/35 bg-foreground/5 ring-foreground/15"
                          : "border-foreground/10 bg-background/70 ring-foreground/5 hover:bg-foreground/5"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 rounded border-foreground/30"
                        checked={checked}
                        disabled={saving}
                        onChange={() => toggle(section.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          {section.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-foreground/55">
                          {section.categoriesCount} {countLabel}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {orderedSelected.length >= 2 ? (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-medium text-foreground">
                {t("restaurantDetail.reorderSectionsHeading")}
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={orderedSelected} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {orderedSelected.map((id) => {
                      const name = nameById.get(id) ?? id;
                      return (
                        <SortableOrderRow
                          key={id}
                          id={id}
                          name={name}
                          disabled={saving}
                          dragHandleAria={t("sections.dragHandleAria", { name })}
                        />
                      );
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          ) : null}

          {saveError ? (
            <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{saveError}</p>
          ) : null}

          <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-foreground/10 bg-background/95 py-4 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-11 flex-1 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="min-h-11 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? t("restaurantDetail.editCategoryItemsSaving")
                : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
