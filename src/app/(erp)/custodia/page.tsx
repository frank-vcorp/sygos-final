import { redirect } from "next/navigation";
import { AlmacenBandejaList } from "@/components/almacen-bandeja-list";
import { ActiveFilters, Badge, Card, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, SegmentedNav, Table, Td, Th } from "@/components/ui";
import { mapEquipmentToAlmacenRow } from "@/lib/almacen-bandeja";
import { CUSTODY_LABEL, type Custody } from "@/lib/custody";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";
import { EntradaServicioCell } from "@/components/entrada-servicio-cell";
import { resolveEntradaAttentionType } from "@/lib/almacen-entrada";
import { serviceSeries } from "@/lib/servicios-catalog";
import { isOsDefinitiveCustodyExit } from "@/lib/warehouse-exit";

const FILTERS = ["pendientes", "resguardo", "fuera", "definitiva"] as const;
type CustodiaVista = (typeof FILTERS)[number];

function custodiaVista(vista: string | undefined, almacenBandeja: boolean): CustodiaVista {
  const raw: CustodiaVista = vista && FILTERS.includes(vista as CustodiaVista) ? (vista as CustodiaVista) : "pendientes";
  if (!almacenBandeja && raw === "definitiva") return "pendientes";
  return raw;
}

export default async function CustodiaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "custody.confirm", session.activeCompanyCode) && !can(session.role, "equi.view", session.activeCompanyCode) && !can(session.role, "mot.view", session.activeCompanyCode)) {
    redirect("/inicio");
  }
  const { vista } = await searchParams;
  const almacenBandeja = session.role === "ALMACEN";
  const view = custodiaVista(vista, almacenBandeja);
  const systron = session.activeCompanyCode === "SYSTRON";
  const systronCompany = systron ? null : await prisma.company.findUnique({ where: { code: "SYSTRON" } });
  const baseWhere = systron
    ? { kind: "EQUI" as const, originCompanyId: session.activeCompanyId }
    : {
        kind: "MOT" as const,
        OR: [{ originCompanyId: session.activeCompanyId }, ...(systronCompany ? [{ originCompanyId: systronCompany.id }] : [])],
        ...(view === "resguardo" ? { holderCompanyId: session.activeCompanyId } : {}),
      };

  const bandejaInclude = {
    client: { select: { name: true } },
    originCompany: { select: { code: true } },
    attentions: {
      orderBy: { createdAt: "desc" as const },
      take: 8,
      select: {
        id: true,
        status: true,
        slaStartedAt: true,
        attentionType: true,
        sellerUserId: true,
        technicalCases: {
          orderBy: { createdAt: "asc" as const },
          select: { id: true, folio: true, kind: true, spawnedFromId: true },
        },
      },
    },
  };

  const rows = view === "definitiva"
    ? (
        await prisma.equipment.findMany({
          where: { custody: "FUERA", ...baseWhere },
          include: {
            ...bandejaInclude,
            movements: { where: { cancelledAt: null }, orderBy: { occurredAt: "desc" }, take: 1 },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        })
      ).filter((row) => isOsDefinitiveCustodyExit(row.movements[0]))
    : await prisma.equipment.findMany({
        where: {
          custody:
            view === "pendientes"
              ? systron
                ? "SIN_CUSTODIA"
                : "PENDIENTE_INGRESO"
              : view === "resguardo"
                ? "EN_RESGUARDO"
                : "FUERA_A_PRUEBA",
          ...baseWhere,
        },
        include: bandejaInclude,
        orderBy: { updatedAt: "asc" },
        take: 100,
      });
  const pendingQuotesByEquipment =
    view === "pendientes" && rows.length > 0
      ? new Map(
          (
            await prisma.quote.findMany({
              where: {
                equipmentId: { in: rows.map((row) => row.id) },
                companyId: session.activeCompanyId,
                status: "AUTORIZADA_PENDIENTE_EQUIPO",
                quoteType: { in: ["DIAGNOSTICO", "REPARACION"] },
              },
              select: { equipmentId: true, quoteType: true },
            })
          )
            .filter((quote) => quote.equipmentId)
            .map((quote) => [quote.equipmentId!, quote.quoteType] as const),
        )
      : new Map<string, string>();

  function entradaAttentionType(row: (typeof rows)[number]) {
    const attentions = "attentions" in row
      ? (row.attentions as Array<{ attentionType: string; status: string; slaStartedAt: Date | null }>)
      : [];
    return resolveEntradaAttentionType(attentions, pendingQuotesByEquipment.get(row.id) ?? null);
  }
  const title = systron ? "Almacén" : "Custodia";
  const tabsAll = systron
    ? [
        ["pendientes", "Entradas"],
        ["resguardo", "En resguardo"],
        ["fuera", "Salida a prueba"],
        ["definitiva", "Salida definitiva"],
      ]
    : [
        ["pendientes", "Ingresos"],
        ["resguardo", "En resguardo"],
        ["fuera", "Salida a prueba"],
        ["definitiva", "Salida definitiva"],
      ];
  const tabs = almacenBandeja ? tabsAll : tabsAll.filter(([key]) => key !== "definitiva");
  const vistaQuery = (key: string) => (almacenBandeja ? `?vista=${key}` : "");
  const vistaHref = almacenBandeja ? `?vista=${view}` : "";
  const sellerIds = almacenBandeja
    ? [...new Set(rows.flatMap((row) => row.attentions.map((a) => a.sellerUserId).filter(Boolean) as string[]))]
    : [];
  const sellers = sellerIds.length > 0
    ? new Map(
      (await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } }))
        .map((u) => [u.id, u.name]),
    )
    : new Map<string, string>();
  const almacenRows = almacenBandeja
    ? rows.map((row) => {
      const hideClient = !systron && row.originCompany.code === "SYSTRON";
      const mapped = mapEquipmentToAlmacenRow(row, { vistaQuery: vistaHref, hideClient });
      const attentionRow = row.attentions.find((a) => a.status === "ABIERTA" || a.status === "EN_PROCESO") ?? row.attentions[0];
      const sellerId = attentionRow?.sellerUserId ?? null;
      return { ...mapped, sellerName: sellerId ? sellers.get(sellerId) ?? null : null };
    })
    : [];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={systron
          ? "EQUI de SYSTRON. Los MOT enviados a Servomotores no aparecen aquí."
          : "Ingreso, resguardo, salida a prueba y egreso definitivo de MOT."}
      />
      <SegmentedNav items={tabs.map(([key, label]) => ({ href: `/custodia?vista=${key}`, label, active: view === key }))} />
      <ActiveFilters
        items={
          view !== "pendientes"
            ? [{ label: tabs.find(([key]) => key === view)?.[1] ?? "Vista", clearHref: "/custodia?vista=pendientes" }]
            : []
        }
      />
      {systron && can(session.role, "sale.receive", session.activeCompanyCode) ? <SaleQueue companyId={session.activeCompanyId} /> : null}
      {rows.length === 0 ? (
        <Empty title="Sin equipos en esta vista" body="La custodia cambia solo cuando alguien confirma el movimiento." />
      ) : almacenBandeja ? (
        <AlmacenBandejaList rows={almacenRows} />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Folio</Th>
                  {view === "pendientes" && almacenBandeja ? <Th>Servicio</Th> : null}
                  <Th>Referencia</Th>
                  <Th>Custodia</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const hideClient = !systron && row.originCompany.code === "SYSTRON";
                  const ref = hideClient ? "SYSTRON · intercompañía" : row.client.name;
                  return (
                    <tr key={row.id}>
                      <Td>
                        <RecordLink
                          href={
                            row.kind === "MOT"
                              ? `/motores/${row.id}${vistaQuery(view)}`
                              : `/equipos/${row.id}${vistaQuery(view)}`
                          }
                        >
                          {row.folio}
                        </RecordLink>
                      </Td>
                      {view === "pendientes" && almacenBandeja ? <Td><EntradaServicioCell attentionType={entradaAttentionType(row)} /></Td> : null}
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
            const href = row.kind === "MOT" ? `/motores/${row.id}${vistaQuery(view)}` : `/equipos/${row.id}${vistaQuery(view)}`;
            const attType = view === "pendientes" && almacenBandeja ? entradaAttentionType(row) : null;
            const series = attType ? serviceSeries(attType) : null;
            return (
              <MobileCard
                key={row.id}
                href={href}
                title={series ? `${series} · pendiente` : row.folio}
                meta={
                  <>
                    {series ? <Badge tone="neutral">Espera ingreso</Badge> : null}
                    <Badge>{CUSTODY_LABEL[row.custody as Custody]}</Badge>
                  </>
                }
              >
                {series ? <p className="font-medium">{row.folio}</p> : null}
                <p>{hideClient ? "SYSTRON · intercompañía" : row.client.name}</p>
                {series ? (
                  <p className="text-xs text-[var(--muted)]">
                    Folio {series}: se genera al confirmar la entrada física
                  </p>
                ) : null}
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
