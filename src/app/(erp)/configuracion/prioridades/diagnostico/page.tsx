import { redirect } from "next/navigation";
import { saveDiagnosisPriorityAction } from "../../ceo-actions";
import { PriorityEditor } from "../editor";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/session";

export default async function PrioridadesDiagnosticoPage() {
  const session = await requireCompany();
  if (session.role !== "CEO") redirect("/inicio");
  const priorities = await prisma.priority.findMany({
    where: { companyId: session.activeCompanyId, attentionType: "DIAGNOSTICO" },
    orderBy: { sortOrder: "asc" },
  });
  return (
    <PriorityEditor
      title="Prioridades de diagnóstico"
      subtitle={`${session.activeCompanyName} · Costo fijo y SLA máximo. Los valores iniciales son los que ya tiene SYGOS.`}
      mode="diagnostico"
      priorities={priorities}
      action={saveDiagnosisPriorityAction}
    />
  );
}
