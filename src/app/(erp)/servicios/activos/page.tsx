import { redirect } from "next/navigation";
import { ServiciosTecnicoBandeja } from "@/components/servicios-tecnico-bandeja";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";
import { parseServiciosEquipoKind } from "@/lib/servicios-catalog";

export default async function ServiciosActivosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string; filtro?: string; equipo?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "attention.catalog", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { q, desde, hasta, filtro, equipo } = await searchParams;
  const equipoKind = parseServiciosEquipoKind(equipo);
  const showEquipoKindFilter = session.activeCompanyCode === "SYSTRON";

  return (
    <ServiciosTecnicoBandeja
      companyId={session.activeCompanyId}
      userId={session.userId}
      role={session.role}
      technician={session.role === "TECNICO"}
      canCreate={can(session.role, "attention.create", session.activeCompanyCode)}
      vista="activos"
      query={(q ?? "").trim()}
      desde={desde}
      hasta={hasta}
      panelFiltro={filtro}
      equipoKind={equipoKind}
      showEquipoKindFilter={showEquipoKindFilter}
    />
  );
}
