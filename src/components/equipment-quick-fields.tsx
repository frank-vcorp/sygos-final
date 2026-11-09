"use client";

import { useState } from "react";
import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { FormQuickModal } from "@/components/form-quick-modal";
import { controlClass, Field } from "@/components/ui";
import type { EquipmentCatalogByKind, EquipmentKind } from "@/lib/catalog";
import type { QuickFormFieldMap } from "@/lib/quick-form-persist";

export function EquipmentQuickFieldsModal({
  open,
  onClose,
  onCommit,
  companyCode,
  types,
  brands,
  models,
  catalogByKind,
  title = "Alta de equipo",
  doneLabel = "Guardar y continuar",
}: {
  open: boolean;
  onClose: () => void;
  onCommit?: (fields: QuickFormFieldMap) => string | null | void | Promise<string | null | void>;
  companyCode: string;
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
  catalogByKind?: EquipmentCatalogByKind;
  title?: string;
  doneLabel?: string;
}) {
  const initialKind: EquipmentKind = companyCode === "SERVOMOTORES" ? "MOT" : "EQUI";
  const [kind, setKind] = useState<EquipmentKind>(initialKind);
  const slice = catalogByKind?.[kind] ?? { types, brands, models };
  const kindChoices: EquipmentKind[] = companyCode === "SYSTRON" ? ["EQUI", "MOT"] : ["MOT"];
  return (
    <FormQuickModal
      open={open}
      title={title}
      titleId="equipment-quick-modal-title"
      onClose={onClose}
      onCommit={onCommit}
      doneLabel={doneLabel}
    >
      <Field label="EQUI o MOT">
        <select
          name="equipmentKind"
          className={controlClass}
          value={kind}
          onChange={(event) => setKind(event.target.value === "MOT" ? "MOT" : "EQUI")}
        >
          {kindChoices.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </Field>
      <EquipmentCatalogFields
        key={kind}
        types={slice.types}
        brands={slice.brands}
        models={slice.models}
        typeLabel={kind === "MOT" ? "Tipo de motor" : "Tipo de equipo"}
      />
      <Field label="Número de serie" hint="Opcional.">
        <input name="serial" className={controlClass} />
      </Field>
    </FormQuickModal>
  );
}
