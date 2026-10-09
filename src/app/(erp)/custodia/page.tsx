import { redirect } from "next/navigation";
import { ActiveFilters, Badge, Card, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, SegmentedNav, Table, Td, Th } from "@/components/ui";
import { CUSTODY_LABEL, type Custody } from "@/lib/custody";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

const FILTERS = ["pendientes", "resguardo", "fuera"] as const;

export default async function CustodiaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "custody.confirm", session.activeCompanyCode) && !can(session.role, "equi.view", session.activeCompanyCode) && !can(session.role, "mot.view", session.activeCompanyCode)) {
    redirect("/inicio");
  }
  const { vista } = await searchParams;
  const view = FILTERS.includes(vista as (typeof FILTERS)[number]) ? vista : "pendientes";
  const systron = session.activeCompanyCode === "SYSTRON";
  const custody = view === "pendientes" ? (systron ? "SIN_CUSTODIA" : "PENDIENTE_INGRESO") : view === "resguardo" ? "EN_RESGUARDO" : "FUERA_A_PRUEBA";
  const systronCompany = systron ? null : await prisma.company.findUnique({ where: { code: "SYSTRON" } });
  const rows = await prisma.equipment.findMany({
    where: {
      custody,
      ...(systron
        ? { kind: "EQUI", originCompanyId: session.activeCompanyId }
        : {
            kind: "MOT",
            OR: [{ originCompanyId: session.activeCompanyId }, ...(systronCompany ? [{ originCompanyId: systronCompany.id }] : [])],
            ...(view === "resguardo" ? { holderCompanyId: session.activeCompanyId } : {}),
          }),
    },
    include: { client: { select: { name: true } }, originCompany: { select: { code: true } } },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });
  const title = systron ? "Almacén" : "Custodia";
  const tabs = systron
    ? [
        ["pendientes", "Entradas"],
        ["resguardo", "En resguardo"],
        ["fuera", "Salida a prueba"],
      ]
    : [
        ["pendientes", "Ingresos"],
        ["resguardo", "En resguardo"],
        ["fuera", "Salida a prueba"],
      ];
  return (
    <>
      <PageHeader
        title={title}
        subtitle={systron
          ? "EQUI de SYSTRON. Los MOT enviados a Servomotores no aparecen aquí."
          : "Ingreso, resguardo y salida a prueba de MOT. El egreso definitivo se confirma en el detalle."}
      />
      <SegmentedNav items={tabs.map(([key, label]) => ({ href: `/custodia?vista=${key}`, label, active: view === key }))} />
      <ActiveFilters
        items={
          view !== "pendientes"
            ? [{ label: tabs.find(([key]) => key === view)?.[1] ?? "Vista", clearHref: "/custodia" }]
            : []
        }
      />
      {systron && can(session.role, "sale.receive", session.activeCompanyCode) ? <SaleQueue companyId={session.activeCompanyId} /> : null}
      {rows.length === 0 ? (
        <Empty title="Sin equipos en esta vista" body="La custodia cambia solo cuando alguien confirma el movimiento." />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Folio</Th><Th>Referencia</Th><Th>Custodia</Th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const hideClient = !systron && row.originCompany.code === "SYSTRON";
                  const ref = hideClient ? "SYSTRON · intercompañía" : row.client.name;
                  return (
                    <tr key={row.id}>
                      <Td><RecordLink href={row.kind === "MOT" ? `/motores/${row.id}` : `/equipos/${row.id}`}>{row.folio}</RecordLink></Td>
                      <Td>{ref}</Td>
                      <Td><Badge>{CUSTODY_LABEL[row.custody as Custody]}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => {
            const hideClient = !systron && row.originCompany.code === "SYSTRON";
            const href = row.kind === "MOT" ? `/motores/${row.id}` : `/equipos/${row.id}`;
            return (
              <MobileCard
                key={row.id}
                href={href}
                title={row.folio}
                meta={<Badge>{CUSTODY_LABEL[row.custody as Custody]}</Badge>}
              >
                <p>{hideClient ? "SYSTRON · intercompañía" : row.client.name}</p>
              </MobileCard>
            );
          })}
        />
      )}
    </>
  );
}

async function SaleQueue({ companyId }: { companyId: string }) {
  const sales = await prisma.sale.findMany({
    where: { companyId },
    include: { client: true, lines: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const open = sales.filter((sale) => sale.lines.some((line) => line.qtyReceived < line.qtySold || line.qtyDelivered < line.qtyReceived));
  if (open.length === 0) return null;
  return (
    <Card className="mb-4 p-4">
      <h2 className="font-medium">Mercancía de venta</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Recepción y entrega de lo autorizado. No entra al inventario de refacciones.</p>
      <ul className="mt-3 space-y-2 text-sm">
        {open.map((sale) => {
          const pendingReceive = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtySold - line.qtyReceived), 0);
          const pendingDeliver = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtyReceived - line.qtyDelivered), 0);
          return (
            <li key={sale.id}>
              <RecordLink href={`/ventas/${sale.id}`}>{sale.folio}</RecordLink>
              {" · "}{sale.client.name}
              {pendingReceive > 0 ? ` · por recibir ${pendingReceive}` : ""}
              {pendingDeliver > 0 ? ` · por entregar ${pendingDeliver}` : ""}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
