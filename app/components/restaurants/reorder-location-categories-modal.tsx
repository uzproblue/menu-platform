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

export type ReorderableCategory = {
  id: string;
  name: string;
};

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function SortableCategoryRow({
  id,
  name,
  index,
  dragHandleAria,
  disabled,
}: {
  id: string;
  name: string;
  index: number;
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
      className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-background/70 px-3 py-2.5 ring-1 ring-foreground/5"
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
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-medium text-foreground/70"
        aria-hidden
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{name}</span>
    </li>
  );
}

type ReorderLocationCategoriesModalProps = {
  open: boolean;
  categories: ReorderableCategory[];
  initialOrderIds: string[];
  saving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSave: (orderedIds: string[]) => void;
};

export function ReorderLocationCategoriesModal({
  open,
  categories,
  initialOrderIds,
  saving,
  saveError,
  onClose,
  onSave,
}: ReorderLocationCategoriesModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const hintId = useId();

  const nameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const sessionKey = useMemo(() => {
    if (!open) return "closed";
    return initialOrderIds.join("|");
  }, [open, initialOrderIds]);

  const [keySnapshot, setKeySnapshot] = useState<string>(sessionKey);
  const [order, setOrder] = useState<string[]>(() => [...initialOrderIds]);

  if (keySnapshot !== sessionKey) {
    setKeySnapshot(sessionKey);
    setOrder([...initialOrderIds]);
  }

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

  const hasChanges = !arraysEqual(order, initialOrderIds);
  const canSave = !saving && hasChanges;

  function handleDragEnd(event: DragEndEvent) {
    if (saving) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave(order);
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
            {t("restaurantDetail.reorderCategoriesTitle")}
          </h2>
          <p id={hintId} className="mt-1 text-xs text-foreground/55">
            {t("restaurantDetail.reorderCategoriesHint")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
        >
          {order.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground/55">
              {t("restaurantDetail.menuEmptyHint")}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <ol className="grid grid-cols-1 gap-2">
                  {order.map((id, index) => {
                    const name = nameById.get(id) ?? id;
                    return (
                      <SortableCategoryRow
                        key={id}
                        id={id}
                        name={name}
                        index={index}
                        disabled={saving}
                        dragHandleAria={t("sections.dragHandleAria", { name })}
                      />
                    );
                  })}
                </ol>
              </SortableContext>
            </DndContext>
          )}

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
