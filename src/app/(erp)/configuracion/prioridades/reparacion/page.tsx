import { redirect } from "next/navigation";
import { saveRepairPriorityAction } from "../../ceo-actions";
import { PriorityEditor } from "../editor";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/session";

export default async function PrioridadesReparacionPage() {
  const session = await requireCompany();
  if (session.role !== "CEO") redirect("/inicio");
  const priorities = await prisma.priority.findMany({
    where: { companyId: session.activeCompanyId, attentionType: "REPARACION" },
    orderBy: { sortOrder: "asc" },
  });
  return (
    <PriorityEditor
      title="Prioridades de reparación / OS"
      subtitle={`${session.activeCompanyName} · Incremento porcentual y SLA máximo. Independientes del diagnóstico.`}
      mode="reparacion"
      priorities={priorities}
      action={saveRepairPriorityAction}
    />
  );
}
