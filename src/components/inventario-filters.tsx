"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InventorySearchCombobox } from "@/components/inventory-search-combobox";
import { controlClass } from "@/components/ui";
import { INVENTORY_SEARCH_MIN_LEN, inventoryListHref, type InventoryStockFilter } from "@/lib/inventory-search";

type FamilyRow = { family: string; count: number };
type RackRow = { rack: string; count: number };

export function InventarioFilters({
  query,
  family,
  rack,
  stock,
  families,
  racks,
}: {
  query: string;
  family: string;
  rack: string;
  stock: InventoryStockFilter;
  families: FamilyRow[];
  racks: RackRow[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);

  useEffect(() => {
    setQ(query);
  }, [query]);

  function navigate(next: { query?: string; family?: string; rack?: string; stock?: InventoryStockFilter }) {
    router.push(
      inventoryListHref({
        query: next.query ?? q,
        family: next.family ?? family,
        rack: next.rack ?? rack,
        stock: next.stock ?? stock,
      }),
    );
  }

  useEffect(() => {
    const trimmed = q.trim();
    const current = query.trim();
    if (trimmed === current) return;
    if (trimmed.length > 0 && trimmed.length < INVENTORY_SEARCH_MIN_LEN) return;
    const handle = window.setTimeout(() => navigate({ query: q }), 450);
    return () => window.clearTimeout(handle);
  }, [q, query, family, rack, stock]);

  return (
    <div
      className="mb-4 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-white p-3 shadow-[0_4px_14px_rgba(20,45,75,0.04)] sm:flex-row sm:flex-wrap sm:items-center"
      role="search"
    >
      <div className="sm:min-w-[10rem] sm:flex-1">
        <InventorySearchCombobox
          defaultValue={query}
          value={q}
          onValueChange={setQ}
          placeholder="Buscar producto, descripción, familia…"
          inputClassName={`${controlClass} w-full`}
          onEnter={(term) => navigate({ query: term })}
          onPick={(hit) => navigate({ query: hit.partNumber })}
        />
      </div>
      <select
        aria-label="Familia"
        className={`${controlClass} sm:max-w-[11rem]`}
        value={family}
        onChange={(event) => navigate({ family: event.target.value })}
      >
        <option value="">Todas las familias</option>
        {families.map((row) => (
          <option key={row.family} value={row.family}>
            {row.family} ({row.count})
          </option>
        ))}
      </select>
      <select
        aria-label="Rack"
        className={`${controlClass} sm:max-w-[10rem]`}
        value={rack}
        onChange={(event) => navigate({ rack: event.target.value })}
      >
        <option value="">Todos los racks</option>
        {racks.map((row) => (
          <option key={row.rack} value={row.rack}>
            {row.rack} ({row.count})
          </option>
        ))}
      </select>
      <select
        aria-label="Existencia"
        className={`${controlClass} sm:max-w-[11rem]`}
        value={stock}
        onChange={(event) => navigate({ stock: event.target.value as InventoryStockFilter })}
      >
        <option value="">Cualquier existencia</option>
        <option value="disponible">Con disponible</option>
        <option value="cero">Sin existencia</option>
        <option value="bajo_minimo">Bajo mínimo</option>
      </select>
    </div>
  );
}
