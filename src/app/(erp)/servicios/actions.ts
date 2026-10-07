"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { clientIdFromForm } from "@/lib/form-quick-entities";
import { optionalText, requiredText } from "@/lib/form";
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
    const kind = optionalText(formData.get("equipmentKind"));
    const equipmentId = optionalText(formData.get("equipmentId"));
    let clientId = optionalText(formData.get("clientId"));
    if (!equipmentId && !clientId) {
      ({ clientId } = await clientIdFromForm(session, formData));
    }
    const attention = await startService(session, {
      attentionType,
      clientId,
      newClientName: null,
      contactName: null,
      equipmentId: optionalText(formData.get("equipmentId")),
      equipmentKind: kind === "EQUI" || kind === "MOT" ? kind : null,
      model: optionalText(formData.get("model")),
      typeName: optionalText(formData.get("newType")) ?? optionalText(formData.get("typeName")),
      brandName: optionalText(formData.get("newBrand")) ?? optionalText(formData.get("brandName")),
      serial: optionalText(formData.get("serial")),
      priorityId: requiredText(formData.get("priorityId"), "Prioridad"),
      reportedFault: requiredText(formData.get("reportedFault"), "Falla reportada"),
      antecedent: optionalText(formData.get("antecedent")),
      originalCaseId: optionalText(formData.get("originalCaseId")),
      deliveryInstructions: optionalText(formData.get("deliveryInstructions")),
    });
    const equipment = await import("@/lib/db").then(({ prisma }) => prisma.equipment.findUnique({ where: { id: attention.equipmentId } }));
    await setFlash({ tone: "ok", message: "Servicio abierto. El SLA inicia cuando se confirme la entrada física." });
    redirect(equipment?.kind === "MOT" ? `/motores/${attention.equipmentId}` : `/equipos/${attention.equipmentId}`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo abrir el servicio." });
    redirect(back);
  }
}
