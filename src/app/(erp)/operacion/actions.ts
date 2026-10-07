"use server";

import { redirect } from "next/navigation";
import {
  addLog,
  assignCase,
  captureExternalDocument,
  finishDiagnosis,
  finishRepair,
  issuePartRequest,
  markRepairPaid,
  overrideWarranty,
  receivePartRequest,
  reopenCase,
  requestPart,
  startCase,
  validateDiagnosis,
} from "@/lib/technical";
import { setFlash } from "@/lib/flash";
import { supplierIdFromForm } from "@/lib/form-quick-entities";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { requireCompany } from "@/lib/session";

function back(formData: FormData) {
  const id = String(formData.get("caseId") ?? "");
  return id ? `/operacion/${id}` : "/operacion";
}

async function run(formData: FormData, work: (session: Awaited<ReturnType<typeof requireCompany>>) => Promise<void>, ok: string) {
  const target = back(formData);
  try {
    const session = await requireCompany();
    await work(session);
    await setFlash({ tone: "ok", message: ok });
    redirect(target);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar." });
    redirect(target);
  }
}

export async function assignCaseAction(formData: FormData) {
  "use server";
  await run(formData, async (session) => assignCase(session, requiredText(formData.get("caseId"), "Operación"), parseVersion(formData.get("version")), optionalText(formData.get("assigneeUserId")), await supplierIdFromForm(session, formData)), "Asignación actualizada.");
}

export async function startCaseAction(formData: FormData) {
  "use server";
  await run(formData, (session) => startCase(session, requiredText(formData.get("caseId"), "Operación"), parseVersion(formData.get("version"))), "Trabajo iniciado.");
}

export async function logAction(formData: FormData) {
  "use server";
  await run(formData, (session) => addLog(session, requiredText(formData.get("caseId"), "Operación"), requiredText(formData.get("body"), "Bitácora")), "Entrada de bitácora registrada.");
}

export async function finishDiagnosisAction(formData: FormData) {
  "use server";
  await run(formData, (session) => finishDiagnosis(session, requiredText(formData.get("caseId"), "Operación"), parseVersion(formData.get("version")), requiredText(formData.get("resultText"), "Resultado")), "Diagnóstico terminado.");
}

export async function validateAction(formData: FormData) {
  "use server";
  const decision = requiredText(formData.get("decision"), "Decisión");
  if (!["VALIDAR", "DEVOLVER", "VALIDA", "NO_PROCEDENTE"].includes(decision)) throw new Error("Decisión no reconocida.");
  await run(formData, (session) => validateDiagnosis(session, requiredText(formData.get("caseId"), "Operación"), parseVersion(formData.get("version")), decision as "VALIDAR" | "DEVOLVER" | "VALIDA" | "NO_PROCEDENTE", optionalText(formData.get("reason"))), "Validación registrada.");
}

export async function finishRepairAction(formData: FormData) {
  "use server";
  const outcome = formData.get("outcome") === "SIN_REPARACION" ? "SIN_REPARACION" : "TERMINADA";
  await run(formData, (session) => finishRepair(session, requiredText(formData.get("caseId"), "Operación"), parseVersion(formData.get("version")), outcome, requiredText(formData.get("resultText"), "Resultado")), "Cierre técnico registrado.");
}

export async function reopenAction(formData: FormData) {
  "use server";
  await run(formData, (session) => reopenCase(session, requiredText(formData.get("caseId"), "Operación"), parseVersion(formData.get("version")), requiredText(formData.get("reason"), "Motivo")), "Operación reabierta.");
}

export async function externalDocumentAction(formData: FormData) {
  "use server";
  await run(formData, (session) => captureExternalDocument(session, requiredText(formData.get("caseId"), "Operación"), parseVersion(formData.get("version")), requiredText(formData.get("document"), "Documento")), "Documento del proveedor capturado. La validación sigue siendo un paso aparte.");
}

export async function markPaidAction(formData: FormData) {
  "use server";
  await run(formData, (session) => markRepairPaid(session, requiredText(formData.get("caseId"), "Operación")), "Reparación marcada como pagada.");
}

export async function overrideWarrantyAction(formData: FormData) {
  "use server";
  const decision = formData.get("decision") === "COTIZAR" ? "COTIZAR" : "VALIDA";
  await run(formData, (session) => overrideWarranty(session, requiredText(formData.get("caseId"), "Operación"), parseVersion(formData.get("version")), decision, requiredText(formData.get("reason"), "Motivo")), "Decisión comercial registrada. La determinación técnica original se conserva.");
}

export async function requestPartAction(formData: FormData) {
  "use server";
  await run(formData, (session) => requestPart(session, requiredText(formData.get("caseId"), "Operación"), {
    partNumber: requiredText(formData.get("partNumber"), "Número de parte"),
    description: requiredText(formData.get("description"), "Descripción"),
    link: optionalText(formData.get("link")),
    quantity: Number(formData.get("quantity")),
  }), "Refacción solicitada.");
}

export async function receivePartAction(formData: FormData) {
  "use server";
  await run(formData, (session) => receivePartRequest(session, requiredText(formData.get("requestId"), "Solicitud"), parseVersion(formData.get("version")), Number(formData.get("quantity"))), "Recepción registrada.");
}

export async function issuePartAction(formData: FormData) {
  "use server";
  await run(formData, (session) => issuePartRequest(session, requiredText(formData.get("requestId"), "Solicitud"), parseVersion(formData.get("version")), Number(formData.get("quantity"))), "Surtido registrado.");
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
