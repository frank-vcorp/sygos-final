import { redirect } from "next/navigation";
import { ServiciosTecnicoBandeja } from "@/components/servicios-tecnico-bandeja";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { parseServicioTipo, usesServiciosBandeja } from "@/lib/servicios-catalog";
import { requireCompany } from "@/lib/session";

export default async function ServiciosHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string; q?: string; desde?: string; hasta?: string }>;
}) {
  const session = await requireCompany();
  if (!usesServiciosBandeja(session.role)) redirect("/servicios");
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
      technician={session.role === "TECNICO"}
      vista="historial"
      tipo={tipo}
      estado={estado}
      query={(q ?? "").trim()}
      desde={desde}
      hasta={hasta}
    />
  );
}
