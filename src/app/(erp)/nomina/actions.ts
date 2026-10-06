"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { parseVersion, requiredText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import { addPayrollAdjustment, adjustAguinaldo, authorizePayroll, editPayrollAdjustment, generateAguinaldo, generatePayroll, retryPayrollFiscal } from "@/lib/personnel";
import { requireCompany } from "@/lib/session";

async function guard(action: Action) {
  const session = await requireCompany();
  if (!can(session.role, action, session.activeCompanyCode)) throw new Error("No tienes permiso para esta acción.");
  return session;
}

function bubble(error: unknown) {
  const redirecting = typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
  if (redirecting) throw error;
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export async function payrollAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("personnel.manage");
    const period = await generatePayroll(session, requiredText(formData.get("weekStart"), "Semana"));
    await setFlash({ tone: "ok", message: `${period.folio} está en preliminar.` });
    redirect(`/nomina/${period.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/nomina");
  }
}

export async function aguinaldoAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("personnel.manage");
    const period = await generateAguinaldo(session, Number(formData.get("year")));
    redirect(`/nomina/${period.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/nomina");
  }
}

export async function authorizePayrollAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("periodId"), "Nómina");
  try {
    const session = await guard("personnel.authorize");
    await authorizePayroll(session, id, parseVersion(formData.get("version")));
    await setFlash({ tone: "ok", message: "Nómina autorizada. No se vuelve a abrir." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${id}`);
}

export async function retryPayrollAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("periodId"), "Nómina");
  try {
    const session = await guard("personnel.manage");
    await retryPayrollFiscal(session, id);
    await setFlash({ tone: "ok", message: "El reintento conservó la misma nómina." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${id}`);
}

export async function extraAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("periodId"), "Nómina");
  try {
    const session = await guard("personnel.manage");
    await addPayrollAdjustment(session, id, requiredText(formData.get("collaboratorId"), "Colaborador"), formData.get("kind") === "DESCUENTO" ? "DESCUENTO" : "INGRESO", formData.get("component") === "EFECTIVO" ? "EFECTIVO" : "TIMBRADO", Number(formData.get("amount")), requiredText(formData.get("note"), "Nota"));
    await setFlash({ tone: "ok", message: "Concepto extraordinario agregado. La prima no entra por aquí." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${id}`);
}

export async function editExtraAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("periodId"), "Nómina");
  try {
    const session = await guard("personnel.authorize");
    await editPayrollAdjustment(session, requiredText(formData.get("adjustmentId"), "Concepto"), Number(formData.get("amount")));
    await setFlash({ tone: "ok", message: "Concepto actualizado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${id}`);
}

export async function aguinaldoAdjustAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("periodId"), "Nómina");
  try {
    const session = await guard("personnel.authorize");
    await adjustAguinaldo(session, requiredText(formData.get("lineId"), "Línea"), Number(formData.get("stamped")), Number(formData.get("cash")));
    await setFlash({ tone: "ok", message: "Aguinaldo ajustado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${id}`);
}
