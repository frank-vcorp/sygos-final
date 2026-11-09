import { requireCeoConfig } from "../guard";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { ensureMotDiagnosisPriorities } from "@/lib/priority-catalog";
import { PriorityColumns } from "./priority-columns";

export default async function OperacionTecnicaPage() {
  const session = await requireCeoConfig();
  await ensureMotDiagnosisPriorities(session.activeCompanyId, session.activeCompanyCode ?? "");
  const diagnosisKind = session.activeCompanyCode === "SERVOMOTORES" ? "MOT" : "EQUI";
  const [diagnosisEqui, diagnosisMot, repair] = await Promise.all([
    prisma.priority.findMany({
      where: { companyId: session.activeCompanyId, attentionType: "DIAGNOSTICO", equipmentKind: diagnosisKind },
      orderBy: { sortOrder: "asc" },
    }),
    session.activeCompanyCode === "SYSTRON"
      ? prisma.priority.findMany({
          where: { companyId: session.activeCompanyId, attentionType: "DIAGNOSTICO", equipmentKind: "MOT" },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    prisma.priority.findMany({
      where: { companyId: session.activeCompanyId, attentionType: "REPARACION" },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/configuracion", label: "Configuración" }}
        title="Operación técnica"
        subtitle={`${session.activeCompanyName} · Diagnóstico EQUI y MOT son catálogos independientes en SYSTRON; en Servomotores solo aplica MOT.`}
      />
      <PriorityColumns diagnosis={diagnosisEqui} diagnosisMot={diagnosisMot} repair={repair} />
    </>
  );
}
