"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { clientIdFromForm } from "@/lib/form-quick-entities";
import { optionalText, parseMexicoDateTimeInput, requiredText } from "@/lib/form";
import { can } from "@/lib/permissions";
import { isAttentionType } from "@/lib/priorities";
import { startService } from "@/lib/equipment-service";
import { requireCompany } from "@/lib/session";

const SLUG: Record<string, string> = {
  DIAGNOSTICO: "diagnostico",
  REPARACION: "reparacion",
  DIAGNOSTICO_GARANTIA: "garantia",
};

export async function startServiceAction(formData: FormData) {
  "use server";
  const attentionType = requiredText(formData.get("attentionType"), "Tipo de servicio");
  const back = `/servicios/${SLUG[attentionType] ?? "diagnostico"}/nuevo`;
  try {
    const session = await requireCompany();
    if (!can(session.role, "attention.create", session.activeCompanyCode)) {
      throw new Error("No puedes abrir este servicio.");
    }
    if (!isAttentionType(attentionType)) throw new Error("Ese tipo de servicio no existe.");
    const equipmentId = optionalText(formData.get("equipmentId"));
    let clientId = optionalText(formData.get("clientId"));
    if (!clientId && !equipmentId) {
      ({ clientId } = await clientIdFromForm(session, formData));
    }
    const priorityId = attentionType === "REPARACION"
      ? optionalText(formData.get("priorityId"))
      : requiredText(formData.get("priorityId"), "Prioridad");
    const allowOrderOverrides = session.role !== "VENTAS";
    const gerenteSystron = session.role === "GERENTE_OPERATIVO_SYSTRON";
    const createdAt = gerenteSystron ? parseMexicoDateTimeInput(formData.get("createdAt")) : null;
    const confirmPhysicalReceipt =
      gerenteSystron
      && formData.get("confirmPhysicalReceipt") === "si"
      && can(session.role, "custody.confirm", session.activeCompanyCode);
    const sellerUserId = allowOrderOverrides && formData.has("sellerUserId")
      ? (optionalText(formData.get("sellerUserId")) ?? null)
      : undefined;
    const attention = await startService(session, {
      attentionType,
      clientId,
      newClientName: null,
      contactName: null,
      equipmentId,
      equipmentKind: null,
      model: null,
      typeName: null,
      brandName: null,
      serial: null,
      priorityId,
      reportedFault: requiredText(formData.get("reportedFault"), "Falla reportada"),
      antecedent: optionalText(formData.get("antecedent")),
      originalCaseId: optionalText(formData.get("originalCaseId")),
      initialLog: optionalText(formData.get("initialLog")),
      sellerUserId,
      legacyFolio: session.role === "GERENTE_OPERATIVO_SYSTRON"
        ? optionalText(formData.get("legacyFolio"))
        : undefined,
      createdAt,
      confirmPhysicalReceipt,
    });
    const equipment = await import("@/lib/db").then(({ prisma }) => prisma.equipment.findUnique({ where: { id: attention.equipmentId } }));
    const enteredShop = confirmPhysicalReceipt && equipment?.kind === "EQUI";
    await setFlash({
      tone: "ok",
      message: enteredShop
        ? attentionType === "REPARACION"
          ? "Reparación Express abierta con ingreso físico confirmado."
          : "Servicio abierto con ingreso físico confirmado y SLA calculado con esa fecha."
        : attentionType === "REPARACION"
          ? "Reparación Express abierta. Entra directo sin plazo SLA."
          : "Servicio abierto. El SLA inicia cuando se confirme la entrada física.",
    });
    redirect(equipment?.kind === "MOT" ? `/motores/${attention.equipmentId}` : `/equipos/${attention.equipmentId}`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo abrir el servicio." });
    redirect(back);
  }
}
