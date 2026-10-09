import { prisma } from "@/lib/db";
import { switchCompanyAction } from "@/app/auth-actions";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { homePath } from "@/lib/home";
import { requireSession } from "@/lib/session";

export default async function EmpresaPage() {
  const session = await requireSession();
  const companies = session.homeCompanyId
    ? await prisma.company.findMany({ where: { id: session.homeCompanyId } })
    : await prisma.company.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Empresa activa" subtitle="El cambio es explícito. No hay una vista que mezcle SYSTRON y Servomotores." />
      <div className="grid gap-3 sm:grid-cols-2">
        {companies.map((company) => {
          const active = session.activeCompanyId === company.id;
          return (
            <Card key={company.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{company.name}</h2>
                  {active ? <Badge tone="ok">Activa</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {active ? "Estás operando en esta empresa." : "Cambia el contexto de datos y permisos a esta razón social."}
                </p>
              </div>
              <form action={switchCompanyAction} className="mt-4">
                <input type="hidden" name="companyId" value={company.id} />
                <input type="hidden" name="next" value={homePath(session.role, company.code)} />
                <Button type="submit" tone={active ? "ghost" : "primary"}>
                  {active ? "Continuar aquí" : "Trabajar en esta empresa"}
                </Button>
              </form>
            </Card>
          );
        })}
      </div>
    </>
  );
}
