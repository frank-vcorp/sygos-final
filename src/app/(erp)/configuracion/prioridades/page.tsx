import { requireCeoConfig } from "../guard";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { PriorityColumns } from "./priority-columns";

export default async function OperacionTecnicaPage() {
  const session = await requireCeoConfig();
  const [diagnosis, repair] = await Promise.all([
    prisma.priority.findMany({
      where: { companyId: session.activeCompanyId, attentionType: "DIAGNOSTICO" },
      orderBy: { sortOrder: "asc" },
    }),
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
        subtitle={`${session.activeCompanyName} · Diagnóstico y reparación / OS son listas independientes, aunque el nombre coincida.`}
      />
      <PriorityColumns diagnosis={diagnosis} repair={repair} />
    </>
  );
}
