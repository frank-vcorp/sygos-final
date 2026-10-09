"use client";

import { useMemo, useRef, useState } from "react";
import { CatalogCombobox, type CatalogComboboxOption } from "@/components/catalog-combobox";

type ModelRow = { type: string; brand: string; model: string };

export function EquipmentCatalogFields({ types, brands, models }: { types: string[]; brands: string[]; models: ModelRow[] }) {
  const [model, setModel] = useState("");
  const [brand, setBrand] = useState("");
  const [typeName, setTypeName] = useState("");
  const brandRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLInputElement>(null);

  const modelOptions = useMemo<CatalogComboboxOption[]>(
    () =>
      models.map((row) => ({
        id: `${row.type}-${row.brand}-${row.model}`,
        label: row.model,
        hint: `${row.type} · ${row.brand}`,
      })),
    [models],
  );

  const brandOptions = useMemo<CatalogComboboxOption[]>(
    () => brands.map((name) => ({ id: name, label: name })),
    [brands],
  );

  const typeOptions = useMemo<CatalogComboboxOption[]>(
    () => types.map((name) => ({ id: name, label: name })),
    [types],
  );

  function applyModelFromCatalog(option: CatalogComboboxOption) {
    const row = models.find((item) => `${item.type}-${item.brand}-${item.model}` === option.id);
    if (!row) return;
    setBrand(row.brand);
    setTypeName(row.type);
    window.setTimeout(() => typeRef.current?.focus(), 0);
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <CatalogCombobox
          label="Modelo"
          hint="Escribe, flechas y Enter. Si eliges del catálogo, marca y tipo se llenan solos."
          name="model"
          required
          value={model}
          onValueChange={setModel}
          options={modelOptions}
          allowCreate
          createLabel={(query) => `Usar «${query}» como modelo nuevo`}
          onPick={applyModelFromCatalog}
        />
      </div>
      <CatalogCombobox
        label="Marca"
        hint="Elige existente o confirma una nueva con Enter."
        name="brandName"
        required
        value={brand}
        onValueChange={setBrand}
        options={brandOptions}
        allowCreate
        createLabel={(query) => `Crear marca «${query}»`}
        inputRef={brandRef}
      />
      <CatalogCombobox
        label="Tipo de equipo"
        hint="Elige existente o confirma uno nuevo con Enter."
        name="typeName"
        required
        value={typeName}
        onValueChange={setTypeName}
        options={typeOptions}
        allowCreate
        createLabel={(query) => `Crear tipo «${query}»`}
        inputRef={typeRef}
      />
    </div>
  );
}
