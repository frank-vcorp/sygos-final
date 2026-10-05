"use client";

import { useMemo, useState } from "react";
import { controlClass, Field } from "@/components/ui";

export function EquipmentCatalogFields({
  types,
  brands,
  models,
}: {
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
}) {
  const [typeName, setTypeName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [customType, setCustomType] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const suggestions = useMemo(() => {
    const type = customType || typeName;
    const brand = customBrand || brandName;
    if (!type || !brand) return [];
    return models.filter((row) => row.type === type && row.brand === brand).map((row) => row.model);
  }, [models, typeName, brandName, customType, customBrand]);
  return (
    <>
      <Field label="Tipo de equipo">
        <select name="typeName" className={controlClass} value={typeName} onChange={(event) => setTypeName(event.target.value)}>
          <option value="">Selecciona</option>
          {types.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </Field>
      <Field label="O escribe el tipo" hint="Si no está en la lista, se agrega al catálogo.">
        <input name="newType" value={customType} onChange={(event) => setCustomType(event.target.value)} className={controlClass} />
      </Field>
      <Field label="Marca">
        <select name="brandName" className={controlClass} value={brandName} onChange={(event) => setBrandName(event.target.value)}>
          <option value="">Selecciona</option>
          {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
        </select>
      </Field>
      <Field label="O escribe la marca"><input name="newBrand" value={customBrand} onChange={(event) => setCustomBrand(event.target.value)} className={controlClass} /></Field>
      <Field label="Modelo" hint="Se sugieren los modelos de ese tipo y esa marca. Si escribes uno nuevo, se agrega.">
        <input name="model" required list="equipo-modelos" className={controlClass} />
        <datalist id="equipo-modelos">
          {suggestions.map((model) => <option key={model} value={model} />)}
        </datalist>
      </Field>
    </>
  );
}
