"use client";

import React from "react";

interface LocationTypeSelectorProps {
  value: "dine_in" | "delivery";
  onChange: (type: "dine_in" | "delivery") => void;
  disabled?: boolean;
}

export function LocationTypeSelector({
  value,
  onChange,
  disabled = false,
}: LocationTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-foreground/70">
        Location Type
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("dine_in")}
          className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
            value === "dine_in"
              ? "border-emerald-500/80 bg-emerald-500/10 shadow-sm ring-2 ring-emerald-500/20"
              : "border-foreground/15 bg-background/50 hover:border-foreground/30 hover:bg-background"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-2xl">🍽️</span>
            {value === "dine_in" && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                Selected
              </span>
            )}
          </div>
          <span className="mt-2 font-semibold text-foreground text-sm">
            Dine-In (Standard)
          </span>
          <span className="mt-1 text-xs text-foreground/60 leading-relaxed">
            In-restaurant dining with physical tables, per-table QR codes, staff alerts, and POS terminal sync.
          </span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("delivery")}
          className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
            value === "delivery"
              ? "border-blue-500/80 bg-blue-500/10 shadow-sm ring-2 ring-blue-500/20"
              : "border-foreground/15 bg-background/50 hover:border-foreground/30 hover:bg-background"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-2xl">🛵</span>
            {value === "delivery" && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                Selected
              </span>
            )}
          </div>
          <span className="mt-2 font-semibold text-foreground text-sm">
            Delivery Storefront
          </span>
          <span className="mt-1 text-xs text-foreground/60 leading-relaxed">
            Online ordering storefront with Mapbox address & pin, cover banner, phone ordering, and one single delivery QR code.
          </span>
        </button>
      </div>
    </div>
  );
}
