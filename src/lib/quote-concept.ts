export const TECHNICAL_SERVICE_CONCEPT_TITLE = "Servicio de reparación y mantenimiento";

export function technicalServiceConcept(input: {
  typeName: string | null;
  brandName: string | null;
  model: string | null;
  serial: string | null;
}) {
  const equipment = [input.typeName, input.brandName, input.model].filter(Boolean).join(" ");
  return [
    TECHNICAL_SERVICE_CONCEPT_TITLE,
    equipment || "Equipo sin identificación completa",
    input.serial ? `Número de serie: ${input.serial}` : null,
  ].filter(Boolean).join("\n");
}
