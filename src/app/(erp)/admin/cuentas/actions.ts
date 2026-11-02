"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyAdminBalanceAdjustment } from "@/lib/admin-finance-balance";
import { setFlash } from "@/lib/flash";
import { requiredText } from "@/lib/form";
import { moneyFromForm } from "@/lib/money";
import { requireCompany } from "@/lib/session";

function bubble(error: unknown) {
  const redirecting = typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
  if (redirecting) throw error;
  return error instanceof Error ? error.message : "No se pudo ajustar el saldo.";
}

function assertAdminMaintenance(session: Awaited<ReturnType<typeof requireCompany>>) {
  if (session.realRole !== "ADMINISTRADOR" || session.impersonating) {
    throw new Error("Solo el administrador real puede ajustar saldos en producción.");
  }
}

export async function adjustAccountBalanceAction(formData: FormData) {
  "use server";
  const session = await requireCompany();
  try {
    assertAdminMaintenance(session);
    if (formData.get("confirm") !== "si") {
      throw new Error("Confirma que el ajuste se aplicará en la base de producción.");
    }
    const accountId = requiredText(formData.get("accountId"), "Cuenta");
    const motivo = requiredText(formData.get("motivo"), "Motivo");
    const targetBalance = moneyFromForm(formData.get("targetBalance"));
    const { account, plan } = await applyAdminBalanceAdjustment(session.activeCompanyId, accountId, targetBalance, motivo);
    await setFlash({
      tone: "ok",
      message: `Saldo de «${account.name}» actualizado a ${plan.target.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.`,
    });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  revalidatePath("/admin/cuentas");
  redirect("/admin/cuentas");
}
