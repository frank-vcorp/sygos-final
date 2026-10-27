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
  brandName: string | null;
  model: string;
  serial: string | null;
}) {
  const label = [equipment.brandName, equipment.model, equipment.serial].filter(Boolean).join(" · ");
  return label || "—";
}

export function equipmentDetailHref(equipment: { id: string; kind: string }) {
  return equipment.kind === "MOT" ? `/motores/${equipment.id}` : `/equipos/${equipment.id}`;
}
