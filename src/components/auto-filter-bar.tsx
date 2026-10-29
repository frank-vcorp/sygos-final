"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FilterValues = Record<string, string>;

export function CompactFilterBar({
  children,
  onSubmit,
  className = "",
}: {
  children: React.ReactNode;
  onSubmit: () => void;
  className?: string;
}) {
  return (
    <form
      className={`mb-3 flex flex-col gap-2 py-1 sm:flex-row sm:flex-wrap sm:items-center ${className} [&_input]:min-h-8 [&_input]:rounded-full [&_input]:border-slate-200/90 [&_input]:bg-slate-100/70 [&_input]:px-3.5 [&_input]:py-1 [&_input]:text-xs [&_input]:font-medium [&_input]:shadow-none [&_input:hover]:bg-slate-100 [&_input:focus]:bg-white [&_select]:min-h-8 [&_select]:rounded-full [&_select]:border-slate-200/90 [&_select]:bg-slate-100/70 [&_select]:px-3 [&_select]:py-1 [&_select]:text-xs [&_select]:font-medium [&_select]:shadow-none [&_select:hover]:bg-slate-100 [&_label]:flex [&_label]:items-center [&_label]:gap-2 [&_label>span:first-child]:mb-0 [&_label>span:first-child]:text-xs [&_label>span:first-child]:font-medium [&_label>span:first-child]:text-slate-500`}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <span className="hidden items-center gap-1.5 pr-1 text-xs font-medium text-slate-400 sm:inline-flex" aria-hidden>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <path d="M2 3.5h12M4.5 8h7M6.5 12.5h3" />
        </svg>
      </span>
      {children}
    </form>
  );
}

export function useAutoFilters<T extends FilterValues>({
  initialFilters,
  toHref,
  debouncedKeys = [],
  debounceMs = 350,
}: {
  initialFilters: T;
  toHref: (filters: T) => string;
  debouncedKeys?: Array<keyof T>;
  debounceMs?: number;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<T>(initialFilters);
  const initialFilterKey = JSON.stringify(initialFilters);
  const debouncedKeyList = debouncedKeys.join(",");

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilterKey]);

  function navigate(next: T) {
    router.replace(toHref(next));
  }

  function update<K extends keyof T>(key: K, value: T[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (!debouncedKeys.includes(key)) navigate(next);
  }

  useEffect(() => {
    const changed = debouncedKeys.some((key) => filters[key] !== initialFilters[key]);
    if (!changed) return;
    const timer = window.setTimeout(() => navigate(filters), debounceMs);
    return () => window.clearTimeout(timer);
  }, [filters, initialFilterKey, debounceMs, debouncedKeyList]);

  return { filters, update, apply: () => navigate(filters) };
}
