"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { controlClass, Field } from "@/components/ui";
import { catalogKey } from "@/lib/catalog-key";

export type CatalogComboboxOption = {
  id: string;
  label: string;
  hint?: string;
};

export function CatalogCombobox({
  label,
  hint,
  name,
  required,
  value,
  onValueChange,
  options,
  allowCreate,
  createLabel,
  inputRef,
  onPick,
}: {
  label: string;
  hint?: string;
  name: string;
  required?: boolean;
  value: string;
  onValueChange: (next: string) => void;
  options: CatalogComboboxOption[];
  allowCreate?: boolean;
  createLabel?: (query: string) => string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onPick?: (option: CatalogComboboxOption) => void;
}) {
  const listId = useId();
  const innerRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? innerRef;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const trimmed = value.trim();
  const filtered = useMemo(() => {
    const key = catalogKey(value);
    if (!key) return options.slice(0, 12);
    return options
      .filter((row) => catalogKey(row.label).includes(key) || catalogKey(row.hint ?? "").includes(key))
      .slice(0, 12);
  }, [options, value]);

  const exact = useMemo(
    () => trimmed && options.some((row) => catalogKey(row.label) === catalogKey(trimmed)),
    [options, trimmed],
  );

  const showCreate = Boolean(allowCreate && trimmed && !exact);
  const rows = useMemo(() => {
    const out: Array<{ kind: "option"; option: CatalogComboboxOption } | { kind: "create"; label: string }> = filtered.map((option) => ({
      kind: "option",
      option,
    }));
    if (showCreate) {
      out.push({ kind: "create", label: createLabel?.(trimmed) ?? `Usar «${trimmed}»` });
    }
    return out;
  }, [filtered, showCreate, trimmed, createLabel]);

  useEffect(() => {
    setHighlight(0);
  }, [value, rows.length]);

  function pickOption(option: CatalogComboboxOption) {
    onValueChange(option.label);
    onPick?.(option);
    setOpen(false);
  }

  function pickCreate() {
    onValueChange(trimmed);
    setOpen(false);
  }

  function pickHighlighted() {
    const row = rows[highlight];
    if (!row) {
      if (trimmed) pickCreate();
      return;
    }
    if (row.kind === "create") pickCreate();
    else pickOption(row.option);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, Math.max(rows.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && rows.length > 0) {
      event.preventDefault();
      pickHighlighted();
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input
          ref={ref}
          name={name}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={controlClass}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {open && rows.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-[var(--line)] bg-white text-sm shadow-md"
          >
            {rows.map((row, index) => {
              const active = index === highlight;
              if (row.kind === "create") {
                return (
                  <li key="create" role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={`block w-full px-3 py-2 text-left ${active ? "bg-[var(--accent-soft)]" : "hover:bg-[#f3f5f6]"}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pickCreate()}
                    >
                      <span className="font-medium text-[var(--accent)]">{row.label}</span>
                    </button>
                  </li>
                );
              }
              return (
                <li key={row.option.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`block w-full px-3 py-2 text-left ${active ? "bg-[var(--accent-soft)]" : "hover:bg-[#f3f5f6]"}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickOption(row.option)}
                  >
                    <span className="font-medium">{row.option.label}</span>
                    {row.option.hint ? <span className="text-[var(--muted)]"> · {row.option.hint}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}
