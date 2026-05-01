"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n-provider";

type LocationRowActionsMenuProps = {
  locationId: string;
  locationName: string;
  isAdmin: boolean;
  isDefault: boolean;
  onRequestDelete: () => void;
};

const MENU_WIDTH = 176;

export function LocationRowActionsMenu({
  locationId,
  locationName,
  isAdmin,
  isDefault,
  onRequestDelete,
}: LocationRowActionsMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPlaced(false);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const padding = 8;
    let left = rect.right - MENU_WIDTH;
    if (left < padding) left = padding;
    if (left + MENU_WIDTH > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - MENU_WIDTH - padding);
    }
    const top = rect.bottom + 4;
    setCoords({ top, left });
    setPlaced(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (triggerRef.current?.contains(node)) return;
      if (menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const editHref = `/restaurants/${encodeURIComponent(locationId)}/edit`;
  const canDelete = isAdmin && !isDefault;

  return (
    <div className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-transparent text-foreground/70 transition-colors hover:border-foreground/15 hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="sr-only">
          {t("restaurants.locationActionsMenuAria", { name: locationName })}
        </span>
        <svg
          className="size-4.5"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18" r="1.5" />
        </svg>
      </button>
      {open && placed
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-orientation="vertical"
              className="fixed z-50 min-w-[11rem] rounded-xl border border-foreground/10 bg-background/95 py-1 shadow-lg ring-1 ring-foreground/10 backdrop-blur-md"
              style={{
                top: coords.top,
                left: coords.left,
                width: MENU_WIDTH,
              }}
            >
              <Link
                role="menuitem"
                href={editHref}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t("common.edit")}
              </Link>
              {isAdmin ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canDelete}
                  title={
                    isDefault
                      ? t("restaurants.cannotDeleteDefaultLocation")
                      : undefined
                  }
                  onClick={() => {
                    if (!canDelete) return;
                    setOpen(false);
                    onRequestDelete();
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                >
                  {t("common.delete")}
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
