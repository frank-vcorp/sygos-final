import { notFound, redirect } from "next/navigation";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { SERVICIO_TIPO_PARAM, serviciosListHref, type ServicioTipoParam } from "@/lib/servicios-catalog";
import { requireCompany } from "@/lib/session";

/** Rutas legadas `/servicios/diagnostico` → bandeja unificada. */
export default async function ServiciosTipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<{ q?: string; vista?: string }>;
}) {
  const { tipo } = await params;
  const { q, vista } = await searchParams;
  if (!(tipo in SERVICIO_TIPO_PARAM)) notFound();
  const tipoParam = tipo as ServicioTipoParam;
  const session = await requireCompany();
  if (!can(session.role, "attention.catalog", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  redirect(
    serviciosListHref({
      tipo: tipoParam,
      q: q?.trim(),
      vista: vista === "historial" ? "historial" : undefined,
    }),
  );
}
