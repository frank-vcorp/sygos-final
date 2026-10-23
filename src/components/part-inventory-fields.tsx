"use client";

import { useEffect, useId, useRef, useState } from "react";
import { controlClass, Field } from "@/components/ui";
import { INVENTORY_SEARCH_MIN_LEN } from "@/lib/inventory-search";
import { formatUbicacion } from "@/lib/inventory-location";

type Hit = {
  id: string;
  partNumber: string;
  description: string;
  family: string;
  catalogNumero: string;
  rack: string;
  nivel: string;
  available: number;
};

function hitLabel(row: Hit) {
  const ubic = formatUbicacion(row.rack, row.nivel);
  const meta = [row.family, row.catalogNumero && `Núm. ${row.catalogNumero}`, ubic].filter(Boolean).join(" · ");
  return `${row.partNumber} · ${row.description || "Sin descripción"}${meta ? ` · ${meta}` : ""} · disp. ${row.available}`;
}

export function PartInventoryFields({
  inventoryEnabled,
  initialPartNumber = "",
  initialDescription = "",
  initialPartId = "",
}: {
  inventoryEnabled: boolean;
  initialPartNumber?: string;
  initialDescription?: string;
  initialPartId?: string;
}) {
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState("");
  const [partNumber, setPartNumber] = useState(initialPartNumber);
  const [description, setDescription] = useState(initialDescription);
  const [partId, setPartId] = useState(initialPartId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Hit[]>([]);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (!inventoryEnabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = search.trim();
    if (term.length < INVENTORY_SEARCH_MIN_LEN) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void fetch(`/inventario/buscar?q=${encodeURIComponent(term)}`)
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .then((body: { items?: Hit[] }) => {
          setItems(body.items ?? []);
          setHighlight(0);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, inventoryEnabled]);

  function choose(row: Hit) {
    setPartId(row.id);
    setPartNumber(row.partNumber);
    setDescription(row.description);
    setSearch("");
    setOpen(false);
  }

  if (!inventoryEnabled) {
    return (
      <>
        <Field label="Número de parte">
          <input name="partNumber" required defaultValue={initialPartNumber} className={controlClass} />
        </Field>
        <Field label="Descripción">
          <input name="description" required defaultValue={initialDescription} className={controlClass} />
        </Field>
      </>
    );
  }

  return (
    <>
      <input type="hidden" name="inventoryPartId" value={partId} />
      <Field label="Buscar en inventario">
        <div className="relative">
          <input
            type="search"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className={controlClass}
            placeholder="Producto, descripción, familia, ubicación…"
            value={search}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 160)}
            onChange={(event) => {
              setSearch(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (!open || items.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlight((current) => Math.min(current + 1, items.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const row = items[highlight];
                if (row) choose(row);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          {open && search.trim().length >= INVENTORY_SEARCH_MIN_LEN ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[var(--line)] bg-white py-1 text-sm shadow-lg"
            >
              {loading ? <li className="px-3 py-2 text-[var(--muted)]">Buscando…</li> : null}
              {!loading && items.length === 0 ? (
                <li className="px-3 py-2 text-[var(--muted)]">Sin coincidencias. Puedes capturar la pieza abajo.</li>
              ) : null}
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
      </Field>
      <Field label="Número de parte">
        <input
          name="partNumber"
          required
          className={controlClass}
          value={partNumber}
          onChange={(event) => {
            setPartNumber(event.target.value);
            setPartId("");
          }}
        />
      </Field>
      <Field label="Descripción">
        <input
          name="description"
          required
          className={controlClass}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setPartId("");
          }}
        />
      </Field>
    </>
  );
}
