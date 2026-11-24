import type { Role } from "./roles";

const SALES_BILLING_READONLY_MESSAGE = "Los vendedores solo pueden consultar documentos ya emitidos.";
const SALES_BILLING_REQUESTED_HIDDEN_MESSAGE =
  "Este documento está solicitado y aún no se puede abrir. Aparecerá en Facturación hasta que se emita.";

/** En listados: VENTAS no navega a solicitudes pendientes de emitir. */
export function billingSalesListDetailHref(
  role: Role,
  doc: { id: string; status: string },
): string | null {
  if (role !== "VENTAS") return `/facturacion/${doc.id}`;
  if (doc.status === "SOLICITADA") return null;
  return `/facturacion/${doc.id}`;
}

/** Detalle de facturación accesible para el rol (página y APIs de lectura). */
export function billingSalesCanViewBillingDetail(role: Role, doc: { status: string }): boolean {
  if (role !== "VENTAS") return true;
  return doc.status !== "SOLICITADA";
}

export function billingSalesDetailReadOnly(role: Role): boolean {
  return role === "VENTAS";
}

export function billingSalesCannotMutateMessage(): string {
  return SALES_BILLING_READONLY_MESSAGE;
}

export function billingSalesRequestedDocumentMessage(): string {
  return SALES_BILLING_REQUESTED_HIDDEN_MESSAGE;
}