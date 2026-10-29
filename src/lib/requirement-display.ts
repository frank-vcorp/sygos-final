export function requirementPartNumberRequired(kind: string) {
  return kind === "REFACCION";
}

export function requirementPartidaLabel(row: { partNumber: string; description: string }) {
  const description = row.description.trim();
  if (description) return description;
  const partNumber = row.partNumber.trim();
  if (partNumber) return partNumber;
  return "—";
}

export function equipmentIdentificationLabel(equipment: {
  folio?: string | null;
  typeName?: string | null;
  brandName: string | null;
  model: string;
  serial?: string | null;
}) {
  const folio = equipment.folio?.trim();
  if (folio) {
    const spec = [equipment.typeName, equipment.brandName, equipment.model].filter(Boolean).join(" | ");
    return spec ? `${folio} | ${spec}` : folio;
  }
  const label = [equipment.brandName, equipment.model, equipment.serial].filter(Boolean).join(" · ");
  return label || "—";
}

export function equipmentDetailHref(equipment: { id: string; kind: string }) {
  return equipment.kind === "MOT" ? `/motores/${equipment.id}` : `/equipos/${equipment.id}`;
}
