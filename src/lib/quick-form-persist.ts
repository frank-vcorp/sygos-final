export type QuickFormFieldMap = Record<string, string>;

export function readNamedFormFields(root: HTMLElement): QuickFormFieldMap {
  const out: QuickFormFieldMap = {};
  for (const el of root.querySelectorAll<HTMLElement>("[name]")) {
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) out[el.name] = el.value;
        continue;
      }
    }
    if ("value" in el && typeof (el as HTMLInputElement).value === "string") {
      const name = el.getAttribute("name");
      if (name) out[name] = (el as HTMLInputElement).value;
    }
  }
  return out;
}

export function validateQuickClientDraft(fields: QuickFormFieldMap): string | null {
  if (!fields.newClientName?.trim() || !fields.contactName?.trim() || !fields.contactPhone?.trim()) {
    return "Indica el nombre del cliente, del contacto y su teléfono.";
  }
  return null;
}

export function validateQuickSupplierDraft(fields: QuickFormFieldMap): string | null {
  if (!fields.newSupplierName?.trim()) {
    return "Indica el nombre del proveedor.";
  }
  return null;
}

export function validateQuickEquipmentDraft(fields: QuickFormFieldMap): string | null {
  if (!fields.model?.trim()) {
    return "Indica el modelo del equipo.";
  }
  if (fields.equipmentKind !== "EQUI" && fields.equipmentKind !== "MOT") {
    return "Indica si el equipo es EQUI o MOT.";
  }
  if (!fields.brandName?.trim() && !fields.newBrand?.trim()) {
    return "Indica la marca del equipo.";
  }
  if (!fields.typeName?.trim() && !fields.newType?.trim()) {
    return "Indica el tipo de equipo.";
  }
  return null;
}
