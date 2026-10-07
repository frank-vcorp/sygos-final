import { prisma } from "@/lib/db";
import { switchCompanyAction } from "@/app/auth-actions";
import { Button, PageHeader } from "@/components/ui";
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
        {companies.map((company) => (
          <form key={company.id} action={switchCompanyAction} className="rounded-lg border border-[var(--line)] bg-white p-4">
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="next" value={homePath(session.role, company.code)} />
            <h2 className="text-lg font-semibold">{company.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {session.activeCompanyId === company.id ? "Es la empresa activa ahora." : "Cambiar a esta empresa."}
            </p>
            <Button type="submit" className="mt-4" tone={session.activeCompanyId === company.id ? "ghost" : "primary"}>
              {session.activeCompanyId === company.id ? "Continuar aquí" : "Trabajar en esta empresa"}
            </Button>
          </form>
        ))}
      </div>
    </>
  );
}
