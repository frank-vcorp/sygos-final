"use client";

import { useMemo, useState } from "react";
import { CatalogCombobox, type CatalogComboboxOption } from "@/components/catalog-combobox";
import { controlClass, Field } from "@/components/ui";

type CatalogPayload = {
  families: Array<{ family: string; count: number }>;
  racks: Array<{ rack: string; count: number }>;
  niveles: Array<{ value: string; count: number }>;
  units: Array<{ value: string; count: number }>;
  mountTypes: Array<{ value: string; count: number }>;
  catalogNumeros: Array<{ value: string; count: number }>;
};

function mapOptions(rows: Array<{ value: string; count: number }>, idPrefix: string): CatalogComboboxOption[] {
  return rows.map((row) => ({
    id: `${idPrefix}-${row.value}`,
    label: row.value,
    hint: `${row.count} en catálogo`,
  }));
}

export function InventoryPartCreateFields({ catalog }: { catalog: CatalogPayload }) {
  const [family, setFamily] = useState("");
  const [rack, setRack] = useState("");
  const [nivel, setNivel] = useState("");
  const [unit, setUnit] = useState("");
  const [mountType, setMountType] = useState("");
  const [catalogNumero, setCatalogNumero] = useState("");

  const familyOptions = useMemo(
    () => catalog.families.map((row) => ({ id: row.family, label: row.family, hint: `${row.count} en catálogo` })),
    [catalog.families],
  );
  const rackOptions = useMemo(
    () => catalog.racks.map((row) => ({ id: row.rack, label: row.rack, hint: `${row.count} en catálogo` })),
    [catalog.racks],
  );
  const nivelOptions = useMemo(() => mapOptions(catalog.niveles, "nivel"), [catalog.niveles]);
  const unitOptions = useMemo(() => mapOptions(catalog.units, "unit"), [catalog.units]);
  const mountOptions = useMemo(() => mapOptions(catalog.mountTypes, "mount"), [catalog.mountTypes]);
  const catalogNumeroOptions = useMemo(() => mapOptions(catalog.catalogNumeros, "num"), [catalog.catalogNumeros]);

  const hasCatalog = familyOptions.length > 0 || rackOptions.length > 0;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Nombre de producto">
        <input name="partNumber" required className={controlClass} />
      </Field>
      <Field label="Descripción">
        <input name="description" className={controlClass} />
      </Field>
      <CatalogCombobox
        label="Número (catálogo)"
        hint="Valores ya usados en inventario; puedes confirmar uno nuevo."
        name="catalogNumero"
        value={catalogNumero}
        onValueChange={setCatalogNumero}
        options={catalogNumeroOptions}
        allowCreate
        createLabel={(query) => `Usar número «${query}»`}
      />
      <CatalogCombobox
        label="Familia"
        hint={hasCatalog ? "Elige una familia del inventario o agrega una nueva." : "Sin familias aún; escribe la primera."}
        name="family"
        value={family}
        onValueChange={setFamily}
        options={familyOptions}
        allowCreate
        createLabel={(query) => `Crear familia «${query}»`}
      />
      <CatalogCombobox
        label="Rack"
        hint="Ubicación en almacén según catálogo importado."
        name="rack"
        value={rack}
        onValueChange={setRack}
        options={rackOptions}
        allowCreate
        createLabel={(query) => `Usar rack «${query}»`}
      />
      <CatalogCombobox
        label="Nivel"
        name="nivel"
        value={nivel}
        onValueChange={setNivel}
        options={nivelOptions}
        allowCreate
        createLabel={(query) => `Usar nivel «${query}»`}
      />
      <CatalogCombobox
        label="Unidad"
        name="unit"
        value={unit}
        onValueChange={setUnit}
        options={unitOptions}
        allowCreate
        createLabel={(query) => `Usar unidad «${query}»`}
      />
      <CatalogCombobox
        label="Montaje"
        name="mountType"
        value={mountType}
        onValueChange={setMountType}
        options={mountOptions}
        allowCreate
        createLabel={(query) => `Usar montaje «${query}»`}
      />
      <Field label="Mínimo informativo">
        <input name="minQty" type="number" min={0} className={controlClass} />
      </Field>
      <Field label="Máximo informativo">
        <input name="maxQty" type="number" min={0} className={controlClass} />
      </Field>
    </div>
  );
}
