import type { StackedStatus } from "@/lib/servicios-bandeja";
import { isReparacionExpressAttentionType } from "@/lib/priorities";

export type ServicioBandejaRow = {
  kind: "servicio";
  id: string;
  equipmentId: string;
  equipmentKind: string;
  equipmentHref: string;
  equipmentLabel: string;
  diagnosisFolio: string | null;
  diagnosisHref: string | null;
  osFolio: string | null;
  osHref: string | null;
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  technical: StackedStatus;
  administrative: StackedStatus;
  physical: StackedStatus;
  sellerName: string | null;
  technicianName: string | null;
  quoteFolio: string | null;
  quoteHref: string | null;
  quoteStatus: string | null;
  quoteSellerUserId: string | null;
  quoteMonto: string;
  slaDueAt: Date | null;
  slaStartedAt: Date | null;
  attentionCreatedAt: Date;
  priorityName: string;
  legacyFolio?: string | null;
  attentionType: string;
  createdAt: Date;
  closedAt: Date | null;
  primaryStatus: string;
};

export type CancelledServicioBandejaRow = {
  kind: "cancelado";
  id: string;
  equipmentId: string;
  equipmentHref: string;
  equipmentLabel: string;
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  closedAt: Date;
  createdAt: Date;
  priorityName: string;
  legacyFolio?: string | null;
};

export type SupervisorServicioRow = ServicioBandejaRow | CancelledServicioBandejaRow;

export function servicioRowHighlight(row: SupervisorServicioRow, now = Date.now()) {
  if (row.kind === "cancelado") {
    return { wrapClass: "", markers: [] as string[] };
  }
  if (isReparacionExpressAttentionType(row.attentionType)) {
    return { wrapClass: "", markers: [] as string[] };
  }
  const overdue = row.slaDueAt != null && row.slaDueAt.getTime() < now;
  const refacciones = row.primaryStatus === "EN_ESPERA_REFACCIONES";
  const markers: string[] = [];
  if (overdue) markers.push("Vencido");
  if (refacciones) markers.push("Refacciones");
  let wrapClass = "";
  if (overdue) {
    wrapClass = "bg-gradient-to-r from-[#fff7ed] to-white ring-1 ring-inset ring-[#fdba74]/80";
  } else if (refacciones) {
    wrapClass = "bg-gradient-to-r from-[#eff6ff] to-white ring-1 ring-inset ring-[#93c5fd]/70";
  }
  return { wrapClass, markers };
}