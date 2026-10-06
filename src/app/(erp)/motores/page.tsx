import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionLink, Badge, Button, controlClass, Empty, FilterBar, ListCap, MobileCard, PageHeader, ResponsiveData, Table, Td, Th, TextLink } from "@/components/ui";
import { CUSTODY_LABEL, type Custody } from "@/lib/custody";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function MotoresPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "mot.view", session.activeCompanyCode)) redirect("/inicio");
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const systron = session.activeCompanyCode === "SERVOMOTORES"
    ? await prisma.company.findUnique({ where: { code: "SYSTRON" } })
    : null;
  const rows = await prisma.equipment.findMany({
    where: {
      kind: "MOT",
      AND: [
        session.activeCompanyCode === "SYSTRON"
          ? { originCompanyId: session.activeCompanyId }
          : { OR: [{ originCompanyId: session.activeCompanyId }, ...(systron ? [{ originCompanyId: systron.id }] : [])] },
        ...(session.role === "VENTAS" ? [{ client: { ownerUserId: session.userId } }] : []),
        ...(query ? [{ OR: [{ folio: { contains: query } }, { model: { contains: query } }, { serial: { contains: query } }] }] : []),
      ],
    },
    include: { client: { select: { name: true } }, originCompany: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        title="Motores"
        subtitle="Folio MOT global. SYSTRON ve los que originó. Servomotores ve los suyos y los que llegan de SYSTRON."
        action={can(session.role, "mot.create", session.activeCompanyCode) ? <ActionLink href="/motores/nuevo">Nuevo MOT</ActionLink> : null}
      />
      <FilterBar action="/motores">
        <input name="q" defaultValue={query} placeholder="Folio, modelo o serie" className={`${controlClass} sm:flex-1`} />
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      {rows.length === 0 ? (
        <Empty
          title={query ? "Sin coincidencias" : "No hay motores"}
          body={query ? `Nada coincide con «${query}».` : "Un MOT identifica el motor o servomotor. No se crean folios de demostración."}
          action={query ? <TextLink href="/motores">Quitar búsqueda</TextLink> : can(session.role, "mot.create", session.activeCompanyCode) ? <TextLink href="/motores/nuevo">Nuevo MOT</TextLink> : undefined}
        />
      ) : (
        <ResponsiveData table={<Table>
          <thead><tr><Th>Folio</Th><Th>Origen</Th><Th>Cliente visible</Th><Th>Identificación</Th><Th>Custodia</Th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const intercompany = session.activeCompanyCode === "SERVOMOTORES" && row.originCompany.code === "SYSTRON";
              return (
                <tr key={row.id}>
                  <Td><Link href={`/motores/${row.id}`} className="font-medium text-[var(--accent)]">{row.folio}</Link></Td>
                  <Td>{row.originCompany.name}</Td>
                  <Td>{intercompany ? "SYSTRON · intercompañía" : row.client.name}</Td>
                  <Td>{[row.brandName, row.model, row.serial].filter(Boolean).join(" · ")}</Td>
                  <Td><Badge>{CUSTODY_LABEL[row.custody as Custody] ?? row.custody}</Badge></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>} cards={rows.map((row) => {
          const intercompany = session.activeCompanyCode === "SERVOMOTORES" && row.originCompany.code === "SYSTRON";
          return <MobileCard key={row.id} href={`/motores/${row.id}`} title={row.folio} meta={<Badge>{CUSTODY_LABEL[row.custody as Custody] ?? row.custody}</Badge>}><p>{intercompany ? "SYSTRON · intercompañía" : row.client.name}</p><p>{row.originCompany.name} · {[row.brandName, row.model, row.serial].filter(Boolean).join(" · ") || "Sin identificación adicional"}</p></MobileCard>;
        })} />
      )}
      <ListCap shown={rows.length} />
    </>
  );
}
