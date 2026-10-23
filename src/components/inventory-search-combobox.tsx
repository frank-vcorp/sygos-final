"use client";

import { useEffect, useId, useRef, useState } from "react";
import { controlClass } from "@/components/ui";
import { INVENTORY_SEARCH_MIN_LEN } from "@/lib/inventory-search";
import { formatUbicacion } from "@/lib/inventory-location";

export type InventorySearchHit = {
  id: string;
  partNumber: string;
  description: string;
  family: string;
  catalogNumero: string;
  rack: string;
  nivel: string;
  available: number;
};

function hitLabel(row: InventorySearchHit) {
  const ubic = formatUbicacion(row.rack, row.nivel);
  const meta = [row.family, row.catalogNumero && `Núm. ${row.catalogNumero}`, ubic].filter(Boolean).join(" · ");
  return `${row.partNumber} · ${row.description || "Sin descripción"}${meta ? ` · ${meta}` : ""} · disp. ${row.available}`;
}

export function InventorySearchCombobox({
  name,
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  required,
  placeholder = "Producto, descripción, familia, ubicación…",
  onPick,
  onEnter,
  inputClassName = controlClass,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (next: string) => void;
  required?: boolean;
  placeholder?: string;
  onPick?: (hit: InventorySearchHit) => void;
  onEnter?: (value: string) => void;
  inputClassName?: string;
}) {
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;
  const setValue = (next: string) => {
    onValueChange?.(next);
    if (controlledValue === undefined) setInternalValue(next);
  };

  useEffect(() => {
    if (controlledValue === undefined) setInternalValue(defaultValue);
  }, [defaultValue, controlledValue]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InventorySearchHit[]>([]);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = value.trim();
    if (term.length < INVENTORY_SEARCH_MIN_LEN) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void fetch(`/inventario/buscar?q=${encodeURIComponent(term)}`, { credentials: "same-origin" })
        .then(async (response) => {
          if (!response.ok) return { items: [] as InventorySearchHit[] };
          return response.json() as Promise<{ items?: InventorySearchHit[] }>;
        })
        .then((body) => {
          setItems(body.items ?? []);
          setHighlight(0);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function choose(row: InventorySearchHit) {
    setValue(row.partNumber);
    onPick?.(row);
    setOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <input
        name={name}
        type="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        required={required}
        className={inputClassName}
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && items.length > 0) {
            event.preventDefault();
            setOpen(true);
            setHighlight((current) => Math.min(current + 1, items.length - 1));
          } else if (event.key === "ArrowUp" && items.length > 0) {
            event.preventDefault();
            setHighlight((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter") {
            if (open && items.length > 0) {
              event.preventDefault();
              const row = items[highlight];
              if (row) choose(row);
            } else {
              onEnter?.(value);
            }
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && value.trim().length >= INVENTORY_SEARCH_MIN_LEN ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[var(--line)] bg-white py-1 text-sm shadow-lg"
        >
          {loading ? <li className="px-3 py-2 text-[var(--muted)]">Buscando…</li> : null}
          {!loading && items.length === 0 ? <li className="px-3 py-2 text-[var(--muted)]">Sin coincidencias.</li> : null}
          {items.map((row, index) => (
            <li key={row.id} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left hover:bg-[#f7fafc] ${index === highlight ? "bg-[var(--accent-soft)]" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(row)}
              >
                {hitLabel(row)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
