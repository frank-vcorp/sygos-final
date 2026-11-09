import { redirect } from "next/navigation";
import { ServiciosTecnicoBandeja } from "@/components/servicios-tecnico-bandeja";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";
import { parseServiciosEquipoKind } from "@/lib/servicios-catalog";

export default async function ServiciosHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; desde?: string; hasta?: string; equipo?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "attention.catalog", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { estado, q, desde, hasta, equipo } = await searchParams;
  const equipoKind = parseServiciosEquipoKind(equipo);

  return (
    <ServiciosTecnicoBandeja
      companyId={session.activeCompanyId}
      userId={session.userId}
      role={session.role}
      technician={session.role === "TECNICO"}
      canCreate={can(session.role, "attention.create", session.activeCompanyCode)}
      vista="historial"
      estado={estado}
      query={(q ?? "").trim()}
      desde={desde}
      hasta={hasta}
      equipoKind={equipoKind}
      showEquipoKindFilter={session.activeCompanyCode === "SYSTRON"}
    />
  );
}
