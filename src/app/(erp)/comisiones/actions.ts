"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { parseVersion, requiredText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import { adjustCommission, generateCommissions, payCommissions } from "@/lib/personnel";
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

export async function commissionAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("personnel.manage");
    const run = await generateCommissions(session, requiredText(formData.get("month"), "Mes"));
    redirect(`/comisiones/${run.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/comisiones");
  }
}

export async function commissionAdjustAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("runId"), "Comisión");
  try {
    const session = await guard("personnel.authorize");
    await adjustCommission(session, requiredText(formData.get("lineId"), "Línea"), Number(formData.get("adjustment") || 0));
    await setFlash({ tone: "ok", message: "Ajuste guardado. El cálculo original se conserva." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/comisiones/${id}`);
}

export async function commissionPayAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("runId"), "Comisión");
  try {
    const session = await guard("personnel.authorize");
    await payCommissions(session, id, parseVersion(formData.get("version")));
    await setFlash({ tone: "ok", message: "Comisión pagada. Una cancelación posterior no reescribe este corte." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/comisiones/${id}`);
}
