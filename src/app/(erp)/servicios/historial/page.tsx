import { redirect } from "next/navigation";
import { ServiciosTecnicoBandeja } from "@/components/servicios-tecnico-bandeja";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { parseServicioTipo } from "@/lib/servicios-catalog";
import { requireCompany } from "@/lib/session";

export default async function ServiciosHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string; q?: string; desde?: string; hasta?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "attention.catalog", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { tipo, estado, q, desde, hasta } = await searchParams;
  const tipoFilter = parseServicioTipo(tipo);
  if (tipo && tipo !== "todos" && !tipoFilter) redirect("/servicios/historial");

  return (
    <ServiciosTecnicoBandeja
      companyId={session.activeCompanyId}
      userId={session.userId}
      role={session.role}
      technician={session.role === "TECNICO"}
      canCreate={can(session.role, "attention.create", session.activeCompanyCode)}
      vista="historial"
      tipo={tipo}
      estado={estado}
      query={(q ?? "").trim()}
      desde={desde}
      hasta={hasta}
    />
  );
}
