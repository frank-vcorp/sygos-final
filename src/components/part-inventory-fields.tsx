"use client";

import { useState } from "react";
import { InventorySearchCombobox, type InventorySearchHit } from "@/components/inventory-search-combobox";
import { controlClass, Field } from "@/components/ui";

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
  const [partNumber, setPartNumber] = useState(initialPartNumber);
  const [description, setDescription] = useState(initialDescription);
  const [partId, setPartId] = useState(initialPartId);

  function applyHit(row: InventorySearchHit) {
    setPartId(row.id);
    setPartNumber(row.partNumber);
    setDescription(row.description);
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
      <Field label="Número de parte" hint="Escribe al menos 2 caracteres y elige del listado; llena descripción automáticamente.">
        <InventorySearchCombobox
          name="partNumber"
          required
          defaultValue={initialPartNumber}
          onPick={applyHit}
          placeholder="Buscar por producto, descripción o familia…"
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
