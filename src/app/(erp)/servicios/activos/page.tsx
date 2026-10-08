import { redirect } from "next/navigation";
import { ServiciosTecnicoBandeja } from "@/components/servicios-tecnico-bandeja";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { parseServicioTipo, usesServiciosBandeja } from "@/lib/servicios-catalog";
import { requireCompany } from "@/lib/session";

export default async function ServiciosActivosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; q?: string; desde?: string; hasta?: string }>;
}) {
  const session = await requireCompany();
  if (!usesServiciosBandeja(session.role)) redirect("/servicios");
  if (!can(session.role, "attention.catalog", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { tipo, q, desde, hasta } = await searchParams;
  const tipoFilter = parseServicioTipo(tipo);
  if (tipo && tipo !== "todos" && !tipoFilter) redirect("/servicios/activos");

  return (
    <ServiciosTecnicoBandeja
      companyId={session.activeCompanyId}
      userId={session.userId}
      technician={session.role === "TECNICO"}
      vista="activos"
      tipo={tipo}
      query={(q ?? "").trim()}
      desde={desde}
      hasta={hasta}
    />
  );
}
