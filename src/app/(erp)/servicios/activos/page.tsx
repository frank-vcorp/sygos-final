import { redirect } from "next/navigation";
import { ServiciosTecnicoBandeja } from "@/components/servicios-tecnico-bandeja";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ServiciosActivosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "attention.catalog", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { q, desde, hasta } = await searchParams;

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
    />
  );
}
