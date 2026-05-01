"use client";

import type { MouseEvent } from "react";

type OpenQrButtonProps = {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
};

export function OpenQrButton({ onClick, ariaLabel }: OpenQrButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex size-10 items-center justify-center rounded-xl border border-transparent text-foreground/70 hover:border-foreground/15 hover:bg-foreground/5 hover:text-foreground"
      aria-label={ariaLabel}
    >
      <svg
        className="size-4.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2m2 0h2m-6 4h2m2 0h2m-4-2v2"
        />
      </svg>
    </button>
  );
}
