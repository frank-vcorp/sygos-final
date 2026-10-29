"use client";

import { useEffect, useState } from "react";
import { clearFlashAction } from "@/app/flash-actions";
import type { Flash } from "@/lib/flash";

export function FlashBanner({ flash }: { flash: Flash }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    document.getElementById("aviso")?.scrollIntoView({ block: "nearest" });
    void clearFlashAction();
  }, [flash.message, flash.tone]);

  const isOk = flash.tone === "ok";

  return (
    <div
      id="aviso"
      role="status"
      aria-live="polite"
      className={
        dismissed
          ? "sr-only"
          : "mb-4 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-all sm:fixed sm:right-6 sm:bottom-6 sm:z-50 sm:mb-0 sm:max-w-md sm:bg-white/95 sm:backdrop-blur-md " +
            (isOk
              ? "border-emerald-200/90 bg-emerald-50/95 text-emerald-900 sm:border-emerald-300/90"
              : "border-rose-200/90 bg-rose-50/95 text-rose-900 sm:border-rose-300/90")
      }
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            isOk ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
          }`}
          aria-hidden
        >
          {isOk ? (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="m3.5 8.5 3 3 6-6.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3.5M8 11h.01" />
            </svg>
          )}
        </span>
        <span className="leading-5">{flash.message}</span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Cerrar aviso"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
      >
        ×
      </button>
    </div>
  );
}
