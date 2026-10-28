import { redirect } from "next/navigation";
import { ProspectosListFilter } from "@/components/compact-list-filters";
import { ActionLink, ActiveFilters, Badge, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

const LABEL: Record<string, string> = {
  NUEVO: "Nuevo",
  EN_SEGUIMIENTO: "En seguimiento",
  CONVERTIDO: "Convertido",
  DESCARTADO: "Descartado",
};

export default async function ProspectosPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "prospect.operate", session.activeCompanyCode)) redirect("/inicio");
  const { q, estado } = await searchParams;
  const query = (q ?? "").trim();
  const status = estado && estado in LABEL ? estado : "ABIERTOS";
  const prospects = await prisma.prospect.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...(status === "ABIERTOS" ? { status: { in: ["NUEVO", "EN_SEGUIMIENTO"] } } : { status }),
      ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}),
      ...(query ? { name: { contains: query } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader title="Prospectos" subtitle="Da seguimiento a oportunidades abiertas y convierte en cliente cuando estén listas." action={<ActionLink href="/prospectos/nuevo">Nuevo prospecto</ActionLink>} />
      <ProspectosListFilter q={query} estado={status} />
      <ActiveFilters
        items={[
          ...(status !== "ABIERTOS" ? [{ label: LABEL[status] ?? status, clearHref: listHref("/prospectos", { q: query || undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: listHref("/prospectos", { estado: status !== "ABIERTOS" ? status : undefined }) }] : []),
        ]}
      />
      {prospects.length === 0 ? <Empty title={query || status !== "ABIERTOS" ? "Sin coincidencias" : "Aún no hay prospectos abiertos"} body={query || status !== "ABIERTOS" ? "Prueba otra búsqueda o consulta los abiertos." : "Registra una oportunidad para comenzar su seguimiento."} action={query || status !== "ABIERTOS" ? <ActionLink href="/prospectos" tone="ghost">Ver abiertos</ActionLink> : <ActionLink href="/prospectos/nuevo">Nuevo prospecto</ActionLink>} /> : (
        <ResponsiveData
          table={<Table><thead><tr><Th>Prospecto</Th><Th>Estado</Th><Th>Fuente</Th></tr></thead><tbody>{prospects.map((prospect) => <tr key={prospect.id}><Td><RecordLink href={`/prospectos/${prospect.id}`}>{prospect.name}</RecordLink></Td><Td><Badge tone={prospect.status === "CONVERTIDO" ? "ok" : prospect.status === "DESCARTADO" ? "neutral" : prospect.status === "EN_SEGUIMIENTO" ? "warn" : "neutral"}>{LABEL[prospect.status] ?? prospect.status}</Badge></Td><Td>{prospect.source ?? "—"}</Td></tr>)}</tbody></Table>}
          cards={prospects.map((prospect) => <MobileCard key={prospect.id} href={`/prospectos/${prospect.id}`} title={prospect.name} meta={<Badge tone={prospect.status === "CONVERTIDO" ? "ok" : prospect.status === "EN_SEGUIMIENTO" ? "warn" : "neutral"}>{LABEL[prospect.status] ?? prospect.status}</Badge>}><p>Fuente: {prospect.source ?? "—"}</p></MobileCard>)}
        />
      )}
    </>
  );
}
