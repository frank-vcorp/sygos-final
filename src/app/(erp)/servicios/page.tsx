import { redirect } from "next/navigation";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { parseServiciosVista, serviciosBandejaHref } from "@/lib/servicios-catalog";
import { requireCompany } from "@/lib/session";

/** Entrada única del menú «Servicios» → bandeja operativa (activos o historial). */
export default async function ServiciosEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string; q?: string; vista?: string; desde?: string; hasta?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "attention.catalog", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { tipo, estado, q, vista, desde, hasta } = await searchParams;
  redirect(
    serviciosBandejaHref({
      vista: parseServiciosVista(vista),
      tipo,
      estado,
      q: (q ?? "").trim(),
      desde,
      hasta,
    }),
  );
}
