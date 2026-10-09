import { redirect } from "next/navigation";
import { ActionLink, Button, controlClass, Empty, FilterBar, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th } from "@/components/ui";
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
      <PageHeader title="Prospectos" subtitle={session.activeCompanyName ?? ""} action={<ActionLink href="/prospectos/nuevo">Nuevo prospecto</ActionLink>} />
      <FilterBar action="/prospectos">
        <input name="q" defaultValue={query} placeholder="Empresa o nombre" className={`${controlClass} sm:flex-1`} />
        <select name="estado" defaultValue={status} className={`${controlClass} sm:w-auto`}>
          <option value="ABIERTOS">Abiertos</option>
          {Object.entries(LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button type="submit" tone="ghost">Filtrar</Button>
      </FilterBar>
      {prospects.length === 0 ? <Empty title="No hay prospectos" body="Nada coincide con el filtro en esta empresa." /> : (
        <ResponsiveData
          table={<Table><thead><tr><Th>Prospecto</Th><Th>Estado</Th><Th>Fuente</Th></tr></thead><tbody>{prospects.map((prospect) => <tr key={prospect.id}><Td><RecordLink href={`/prospectos/${prospect.id}`}>{prospect.name}</RecordLink></Td><Td>{LABEL[prospect.status] ?? prospect.status}</Td><Td>{prospect.source ?? "—"}</Td></tr>)}</tbody></Table>}
          cards={prospects.map((prospect) => <MobileCard key={prospect.id} href={`/prospectos/${prospect.id}`} title={prospect.name} meta={LABEL[prospect.status] ?? prospect.status}><p>Fuente: {prospect.source ?? "—"}</p></MobileCard>)}
        />
      )}
    </>
  );
}
