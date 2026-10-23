"use client";

import { useMemo, useState } from "react";
import { controlClass, Field } from "@/components/ui";

const CUSTOM = "__custom__";

type CatalogOption = { value: string; count: number };

type CatalogPayload = {
  families: Array<{ family: string; count: number }>;
  racks: Array<{ rack: string; count: number }>;
  niveles: CatalogOption[];
  units: CatalogOption[];
  mountTypes: CatalogOption[];
  catalogNumeros: CatalogOption[];
};

function InventoryCatalogSelectField({
  label,
  name,
  hint,
  options,
}: {
  label: string;
  name: string;
  hint?: string;
  options: CatalogOption[];
}) {
  const [mode, setMode] = useState<"list" | "custom">(options.length === 0 ? "custom" : "list");
  const [listValue, setListValue] = useState("");
  const [customValue, setCustomValue] = useState("");

  return (
    <Field label={label} hint={hint}>
      {options.length > 0 ? (
        <select
          aria-label={`${label} del catálogo`}
          className={`${controlClass} ${mode === "custom" ? "mb-2" : ""}`}
          value={mode === "custom" ? CUSTOM : listValue}
          name={mode === "list" ? name : undefined}
          required={mode === "list"}
          onChange={(event) => {
            const next = event.target.value;
            if (next === CUSTOM) {
              setMode("custom");
              setListValue("");
              return;
            }
            setMode("list");
            setListValue(next);
            setCustomValue("");
          }}
        >
          <option value="">— Selecciona del catálogo —</option>
          {options.map((row) => (
            <option key={row.value} value={row.value}>
              {row.value} ({row.count.toLocaleString("es-MX")})
            </option>
          ))}
          <option value={CUSTOM}>Otro (captura manual)</option>
        </select>
      ) : null}
      {mode === "custom" || options.length === 0 ? (
        <input
          name={name}
          className={controlClass}
          placeholder={options.length > 0 ? "Valor nuevo fuera del catálogo" : "Sin valores en catálogo aún"}
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
        />
      ) : null}
    </Field>
  );
}

export function InventoryPartCreateFields({ catalog }: { catalog: CatalogPayload }) {
  const families = useMemo(
    () => catalog.families.map((row) => ({ value: row.family, count: row.count })),
    [catalog.families],
  );
  const racks = useMemo(
    () => catalog.racks.map((row) => ({ value: row.rack, count: row.count })),
    [catalog.racks],
  );

  const hasCatalogData = catalog.families.length > 0 || catalog.racks.length > 0;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {hasCatalogData ? (
        <p className="md:col-span-2 text-sm text-[var(--muted)]">
          Familia, rack, nivel, unidad y montaje se eligen del listado del inventario importado ({catalog.families.length} familias, {catalog.racks.length} racks). Producto y descripción siguen en texto libre.
        </p>
      ) : (
        <p className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Esta base aún no tiene inventario importado: los listados saldrán vacíos hasta cargar el catálogo Oct26 o dar de alta líneas.
        </p>
      )}
      <Field label="Nombre de producto" hint="Texto libre.">
        <input name="partNumber" required className={controlClass} />
      </Field>
      <Field label="Descripción" hint="Texto libre.">
        <input name="description" className={controlClass} />
      </Field>
      <InventoryCatalogSelectField
        label="Número (catálogo)"
        name="catalogNumero"
        hint="Listado del inventario cargado."
        options={catalog.catalogNumeros}
      />
      <InventoryCatalogSelectField label="Familia" name="family" hint="Categoría del catálogo." options={families} />
      <InventoryCatalogSelectField label="Rack" name="rack" hint="Ubicación en almacén." options={racks} />
      <InventoryCatalogSelectField label="Nivel" name="nivel" options={catalog.niveles} />
      <InventoryCatalogSelectField label="Unidad" name="unit" options={catalog.units} />
      <InventoryCatalogSelectField label="Montaje" name="mountType" options={catalog.mountTypes} />
      <Field label="Mínimo informativo">
        <input name="minQty" type="number" min={0} className={controlClass} />
      </Field>
      <Field label="Máximo informativo">
        <input name="maxQty" type="number" min={0} className={controlClass} />
      </Field>
    </div>
  );
}
