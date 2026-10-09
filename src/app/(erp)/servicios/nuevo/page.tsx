import { redirect } from "next/navigation";
import { ActionLink, Card, PageHeader, RecordLink } from "@/components/ui";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { SERVICIO_TIPO_OPTIONS } from "@/lib/servicios-catalog";
import { requireCompany } from "@/lib/session";

export default async function NuevoServicioPage() {
  const session = await requireCompany();
  if (!can(session.role, "attention.create", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  return (
    <>
      <PageHeader
        back={{ href: "/servicios/activos", label: "Servicios" }}
        title="Nuevo servicio"
        subtitle="Elige el tipo de atención. El formulario captura cliente, equipo y falla reportada."
      />
      <ul className="grid gap-3 sm:grid-cols-3">
        {SERVICIO_TIPO_OPTIONS.map((opt) => (
          <li key={opt.param}>
            <Card className="flex h-full flex-col justify-between p-4 transition hover:border-[var(--accent)] hover:shadow-sm">
              <div>
                <RecordLink href={`/servicios/${opt.param}/nuevo`} className="text-base">{opt.label}</RecordLink>
                <p className="mt-2 text-sm text-[var(--muted)]">Alta con cliente y equipo</p>
              </div>
              <ActionLink href={`/servicios/${opt.param}/nuevo`} tone="ghost" className="mt-4 w-full">Continuar</ActionLink>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
