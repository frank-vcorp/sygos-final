import type { QuoteType } from "./quote-meta";

export const TECHNICAL_SERVICE_CONCEPT_TITLE = "Servicio de reparación y mantenimiento";
export const COMMERCIAL_DIAGNOSTIC_CONCEPT_TITLE = "Diagnóstico";
export const COMMERCIAL_FIELD_SERVICE_CONCEPT_TITLE = "Servicio de campo";
export const COMMERCIAL_EQUIPMENT_SALE_CONCEPT_TITLE = "Venta de equipo";

export type QuoteConceptEquipment = {
  typeName: string | null;
  brandName: string | null;
  model: string | null;
  serial: string | null;
};

function equipmentDescriptor(input: QuoteConceptEquipment) {
  const equipment = [input.typeName, input.brandName, input.model].filter(Boolean).join(" ");
  return equipment || "Equipo sin identificación completa";
}

function conceptWithEquipment(title: string, equipment: QuoteConceptEquipment) {
  return [
    title,
    equipmentDescriptor(equipment),
    equipment.serial ? `Número de serie: ${equipment.serial}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function technicalServiceConcept(input: QuoteConceptEquipment) {
  return conceptWithEquipment(TECHNICAL_SERVICE_CONCEPT_TITLE, input);
}

/** Línea predeterminada al crear cotización comercial del vendedor (COTDX/COTOS/COTSC/COTVT). */
export function commercialSellerQuoteConcept(quoteType: QuoteType, equipment: QuoteConceptEquipment | null) {
  switch (quoteType) {
    case "DIAGNOSTICO":
      if (!equipment) return COMMERCIAL_DIAGNOSTIC_CONCEPT_TITLE;
      return conceptWithEquipment(COMMERCIAL_DIAGNOSTIC_CONCEPT_TITLE, equipment);
    case "REPARACION":
      return technicalServiceConcept(
        equipment ?? { typeName: null, brandName: null, model: null, serial: null },
      );
    case "CAMPO":
      return COMMERCIAL_FIELD_SERVICE_CONCEPT_TITLE;
    case "VENTA_EQUIPO":
      if (!equipment) return COMMERCIAL_EQUIPMENT_SALE_CONCEPT_TITLE;
      return conceptWithEquipment(COMMERCIAL_EQUIPMENT_SALE_CONCEPT_TITLE, equipment);
    default:
      return COMMERCIAL_EQUIPMENT_SALE_CONCEPT_TITLE;
  }
}
