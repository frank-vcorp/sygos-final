"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { moneyFromForm, optionalMoneyFromForm } from "@/lib/money";
import {
  addPayrollDocument,
  canAdjustPayrollAmounts,
  generateOrOpenWeeklyPayroll,
  returnPayrollToCorrection,
  sendPayrollToValidation,
  updatePayrollLineAppliedAmounts,
  validateAndClosePayroll,
} from "@/lib/payroll";
import { can, type Action } from "@/lib/permissions";
import {
  addPayrollAdjustment,
  adjustAguinaldo,
  authorizePayroll,
  editPayrollAdjustment,
  generateAguinaldo,
  generatePayroll,
  retryPayrollFiscal,
} from "@/lib/personnel";
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

export async function generatePayrollAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("personnel.manage");
    const periodInput = requiredText(formData.get("periodInput"), "Semana / periodo");
    const paymentDate = optionalText(formData.get("paymentDate"));
    const { period, existed } = await generateOrOpenWeeklyPayroll(session, { periodInput, paymentDate });
    await setFlash({
      tone: "ok",
      message: existed
        ? `Ya existe la nómina ${period.folio} para ese periodo. Se abrió el registro existente.`
        : `Nómina ${period.folio} generada en estado En preparación.`,
    });
    redirect(`/nomina/${period.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/nomina");
  }
}

export async function sendPayrollToValidationAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("periodId"), "Nómina");
  try {
    const session = await guard("personnel.manage");
    await sendPayrollToValidation(session, id, parseVersion(formData.get("version")));
    await setFlash({ tone: "ok", message: "Nómina enviada a validación del CEO." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${id}`);
}

export async function returnPayrollToCorrectionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("periodId"), "Nómina");
  try {
    const session = await guard("personnel.authorize");
    await returnPayrollToCorrection(session, id, parseVersion(formData.get("version")));
    await setFlash({ tone: "ok", message: "Nómina regresada a En corrección." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${id}`);
}

export async function validateAndClosePayrollAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("periodId"), "Nómina");
  try {
    const session = await guard("personnel.authorize");
    await validateAndClosePayroll(session, id, parseVersion(formData.get("version")));
    await setFlash({ tone: "ok", message: "Nómina validada y cerrada definitivamente." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${id}`);
}

export async function updatePayrollLineAmountsAction(formData: FormData) {
  "use server";
  const periodId = requiredText(formData.get("periodId"), "Nómina");
  const collaboratorId = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await requireCompany();
    if (!canAdjustPayrollAmounts(session.role)) {
      throw new Error("No tienes permiso para ajustar importes de nómina.");
    }
    await updatePayrollLineAppliedAmounts(session, periodId, collaboratorId, {
      sueldo: optionalMoneyFromForm(formData.get("sueldo")) ?? 0,
      horasExtra: optionalMoneyFromForm(formData.get("horasExtra")) ?? 0,
      bonos: optionalMoneyFromForm(formData.get("bonos")) ?? 0,
      comision: optionalMoneyFromForm(formData.get("comision")) ?? 0,
      compensaciones: optionalMoneyFromForm(formData.get("compensaciones")) ?? 0,
      primaVacacional: optionalMoneyFromForm(formData.get("primaVacacional")) ?? 0,
    });
    await setFlash({ tone: "ok", message: "Importes aplicados actualizados en esta nómina." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${periodId}/colaboradores/${collaboratorId}`);
}

export async function payrollDocumentAction(formData: FormData) {
  "use server";
  const periodId = requiredText(formData.get("periodId"), "Nómina");
  try {
    const session = await guard("personnel.manage");
    const title = requiredText(formData.get("title"), "Nombre del documento");
    const fileEntry = formData.get("file");
    let fileName: string | null = null;
    let mimeType: string | null = null;
    let fileDataUrl: string | null = null;

    if (fileEntry && typeof fileEntry === "object" && "arrayBuffer" in fileEntry && fileEntry.size > 0) {
      if (fileEntry.size > 5 * 1024 * 1024) {
        throw new Error("El archivo no debe superar 5 MB.");
      }
      fileName = fileEntry.name || `${title}.bin`;
      mimeType = fileEntry.type || "application/octet-stream";
      const buf = Buffer.from(await fileEntry.arrayBuffer());
      fileDataUrl = `data:${mimeType};base64,${buf.toString("base64")}`;
    }

    await addPayrollDocument(session, periodId, title, { fileName, mimeType, fileDataUrl });
    await setFlash({ tone: "ok", message: "Documento agregado a la nómina." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${periodId}?tab=documentos`);
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
    await addPayrollAdjustment(session, id, requiredText(formData.get("collaboratorId"), "Colaborador"), formData.get("kind") === "DESCUENTO" ? "DESCUENTO" : "INGRESO", formData.get("component") === "EFECTIVO" ? "EFECTIVO" : "TIMBRADO", moneyFromForm(formData.get("amount")), requiredText(formData.get("note"), "Nota"));
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
    await editPayrollAdjustment(session, requiredText(formData.get("adjustmentId"), "Concepto"), moneyFromForm(formData.get("amount")));
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
    await adjustAguinaldo(session, requiredText(formData.get("lineId"), "Línea"), moneyFromForm(formData.get("stamped"), "Timbrado"), moneyFromForm(formData.get("cash"), "Efectivo"));
    await setFlash({ tone: "ok", message: "Aguinaldo ajustado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/nomina/${id}`);
}
