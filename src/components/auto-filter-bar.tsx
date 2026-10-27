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
      className={`mb-4 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-white p-3 shadow-[0_4px_14px_rgba(20,45,75,0.04)] sm:flex-row sm:flex-wrap sm:items-center ${className}`}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
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
