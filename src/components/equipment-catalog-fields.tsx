"use client";

import { useMemo, useState } from "react";
import { controlClass, Field } from "@/components/ui";
import { catalogKey } from "@/lib/catalog-key";

type ModelRow = { type: string; brand: string; model: string };

export function EquipmentCatalogFields({ types, brands, models }: { types: string[]; brands: string[]; models: ModelRow[] }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ModelRow | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [typeQuery, setTypeQuery] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const suggestions = useMemo(() => {
    const key = catalogKey(query);
    if (key.length < 2 || picked) return [];
    return models.filter((row) => catalogKey(row.model).includes(key) || catalogKey(`${row.type} ${row.brand} ${row.model}`).includes(key)).slice(0, 8);
  }, [models, query, picked]);
  const typeOptions = types.filter((type) => catalogKey(type).includes(catalogKey(typeQuery))).slice(0, 8);
  const brandOptions = brands.filter((brand) => catalogKey(brand).includes(catalogKey(brandQuery))).slice(0, 8);
  return (
    <div className="grid gap-3">
      <Field label="Modelo" hint="Escribe y elige una sugerencia. Si no existe, se piden tipo y marca.">
        <input
          className={controlClass}
          value={picked ? picked.model : query}
          onChange={(event) => {
            setPicked(null);
            setCreateNew(false);
            setQuery(event.target.value);
          }}
        />
      </Field>
      {suggestions.length > 0 ? (
        <ul className="overflow-hidden rounded-md border border-[var(--line)] bg-white text-sm">
          {suggestions.map((row) => (
            <li key={`${row.type}-${row.brand}-${row.model}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-[#f3f5f6]"
                onClick={() => {
                  setPicked(row);
                  setQuery(row.model);
                  setCreateNew(false);
                }}
              >
                <span className="font-medium">{row.model}</span>
                <span className="text-[var(--muted)]"> · {row.type} · {row.brand}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!picked && catalogKey(query).length >= 2 && suggestions.length === 0 ? (
        <button type="button" className="text-left text-sm font-medium text-[var(--accent)]" onClick={() => setCreateNew(true)}>
          {createNew ? "Captura tipo y marca" : "Este modelo no está. Alta rápida de tipo y marca"}
        </button>
      ) : null}
      {createNew && !picked ? (
        <div className="grid gap-3 rounded-md border border-[var(--line)] p-3">
          <SearchPick label="Tipo de equipo" query={typeQuery} setQuery={setTypeQuery} options={typeOptions} />
          <SearchPick label="Marca" query={brandQuery} setQuery={setBrandQuery} options={brandOptions} />
        </div>
      ) : null}
      <input type="hidden" name="model" value={picked?.model ?? query} />
      <input type="hidden" name="typeName" value={picked?.type ?? ""} />
      <input type="hidden" name="brandName" value={picked?.brand ?? ""} />
      <input type="hidden" name="newType" value={createNew && !picked ? typeQuery : ""} />
      <input type="hidden" name="newBrand" value={createNew && !picked ? brandQuery : ""} />
    </div>
  );
}

function SearchPick({ label, query, setQuery, options }: { label: string; query: string; setQuery: (value: string) => void; options: string[] }) {
  return (
    <Field label={label}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} className={controlClass} placeholder="Escribe para buscar o capturar" />
      {query && options.length > 0 ? (
        <div className="mt-1 rounded-md border border-[var(--line)] bg-white">
          {options.map((option) => (
            <button key={option} type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[#f3f5f6]" onClick={() => setQuery(option)}>
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </Field>
  );
}
