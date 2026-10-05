import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
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
      <PageHeader title="Prospectos" subtitle={session.activeCompanyName ?? ""} action={<Link href="/prospectos/nuevo" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Nuevo prospecto</Link>} />
      <form className="mb-4 flex flex-wrap gap-2" action="/prospectos">
        <input name="q" defaultValue={query} placeholder="Empresa o nombre" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm" />
        <select name="estado" defaultValue={status} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">
          <option value="ABIERTOS">Abiertos</option>
          {Object.entries(LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button type="submit" tone="ghost">Filtrar</Button>
      </form>
      {prospects.length === 0 ? <Empty title="No hay prospectos" body="Nada coincide con el filtro en esta empresa." /> : (
        <Table>
          <thead><tr><Th>Prospecto</Th><Th>Estado</Th><Th>Fuente</Th></tr></thead>
          <tbody>
            {prospects.map((prospect) => (
              <tr key={prospect.id}>
                <Td><Link className="font-medium text-[var(--accent)]" href={`/prospectos/${prospect.id}`}>{prospect.name}</Link></Td>
                <Td>{LABEL[prospect.status] ?? prospect.status}</Td>
                <Td>{prospect.source ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
