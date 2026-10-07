"use client";

import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { FormQuickModal } from "@/components/form-quick-modal";
import { controlClass, Field } from "@/components/ui";
import type { QuickFormFieldMap } from "@/lib/quick-form-persist";

export function EquipmentQuickFieldsModal({
  open,
  onClose,
  onCommit,
  companyCode,
  types,
  brands,
  models,
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
  title?: string;
  doneLabel?: string;
}) {
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
        <select name="equipmentKind" className={controlClass} defaultValue={companyCode === "SERVOMOTORES" ? "MOT" : "EQUI"}>
          {companyCode === "SYSTRON" ? <option value="EQUI">EQUI</option> : null}
          <option value="MOT">MOT</option>
        </select>
      </Field>
      <EquipmentCatalogFields types={types} brands={brands} models={models} />
      <Field label="Serie"><input name="serial" className={controlClass} /></Field>
    </FormQuickModal>
  );
}
