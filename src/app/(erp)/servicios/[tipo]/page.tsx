import { notFound, redirect } from "next/navigation";
import { SERVICIO_TIPO_PARAM, type ServicioTipoParam } from "@/lib/servicios-catalog";

export default async function ServiciosTipoRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { tipo } = await params;
  const { q } = await searchParams;
  if (!(tipo in SERVICIO_TIPO_PARAM)) notFound();
  const search = new URLSearchParams();
  search.set("tipo", tipo as ServicioTipoParam);
  if (q?.trim()) search.set("q", q.trim());
  redirect(`/servicios?${search.toString()}`);
}
