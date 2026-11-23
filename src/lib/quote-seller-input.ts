import { moneyFromForm } from "./money";
import { parseQuoteLineCondition, type QuoteLineCondition } from "./quote-line-condition";

export type SellerSaleLineInput = {
  concept: string;
  quantity: number;
  unitPrice: number;
  lineCondition: QuoteLineCondition;
};

export type FieldServiceMachineInput = {
  brand: string;
  model: string;
  serial: string;
  serviceDescription: string;
};

export function parseSellerSaleLines(formData: FormData): SellerSaleLineInput[] {
  const concepts = formData.getAll("saleLineConcept").map((v) => String(v).trim());
  const quantities = formData.getAll("saleLineQty");
  const prices = formData.getAll("saleLinePrice");
  const conditions = formData.getAll("saleLineCondition");
  if (concepts.length === 0) throw new Error("Agrega al menos un concepto a cotizar.");
  if (concepts.length !== quantities.length || concepts.length !== prices.length || concepts.length !== conditions.length) {
    throw new Error("Revisa los conceptos de la cotización: faltan datos en alguna línea.");
  }
  return concepts.map((concept, index) => {
    if (!concept) throw new Error("Cada línea debe tener concepto.");
    const qtyRaw = String(quantities[index] ?? "1").trim();
    const quantity = Number.parseInt(qtyRaw, 10);
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("La cantidad debe ser un entero mayor o igual a 1.");
    const unitPrice = moneyFromForm(prices[index], "Precio unitario");
    if (unitPrice < 0) throw new Error("El precio no puede ser negativo.");
    const lineCondition = parseQuoteLineCondition(conditions[index]);
    return { concept, quantity, unitPrice, lineCondition };
  });
}

export function parseDeliveryBusinessDays(raw: FormDataEntryValue | null, label = "T.E. (tiempo de entrega)"): number {
  const text = typeof raw === "string" ? raw.trim() : raw === null || raw === undefined ? "" : String(raw).trim();
  if (!text) throw new Error(`Indica ${label} en días hábiles.`);
  const n = Number.parseInt(text, 10);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${label}: usa un entero mayor o igual a 1.`);
  return n;
}

export function parseFieldServiceMachineFromForm(formData: FormData): FieldServiceMachineInput {
  const brand = String(formData.get("fieldServiceBrand") ?? "").trim();
  const model = String(formData.get("fieldServiceModel") ?? "").trim();
  const serial = String(formData.get("fieldServiceSerial") ?? "").trim();
  const serviceDescription = String(formData.get("fieldServiceDescription") ?? "").trim();
  if (!brand) throw new Error("Indica la marca de la máquina.");
  if (!model) throw new Error("Indica el modelo de la máquina.");
  if (!serial) throw new Error("Indica el número de serie de la máquina.");
  if (!serviceDescription) throw new Error("Describe el servicio de campo.");
  return { brand, model, serial, serviceDescription };
}