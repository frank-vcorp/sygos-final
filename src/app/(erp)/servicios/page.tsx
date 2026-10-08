import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import {
  ActionLink,
  Badge,
  Button,
  controlClass,
  Empty,
  FilterBar,
  ListCap,
  MobileCard,
  PageHeader,
  ResponsiveData,
  SegmentedNav,
  Table,
  Td,
  Th,
  TextLink,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { ServiciosTecnicoBandeja } from "@/components/servicios-tecnico-bandeja";
import {
  equipmentScopeForServicios,
  parseServicioTipo,
  parseServiciosVista,
  servicioTipoLabel,
  SERVICIO_TIPO_OPTIONS,
  serviciosListHref,
  usesServiciosBandeja,
} from "@/lib/servicios-catalog";
import { requireCompany } from "@/lib/session";

const CLOSED_CASE = ["VALIDADO", "TERMINADA", "SIN_REPARACION"] as const;

function attentionStatusLabel(status: string) {
  return status === "ABIERTA" ? "Espera ingreso" : "En proceso";
}

export default async function ServiciosCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string; q?: string; vista?: string; desde?: string; hasta?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "attention.catalog", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { tipo, estado, q, vista, desde, hasta } = await searchParams;
  const query = (q ?? "").trim();
  const tipoFilter = parseServicioTipo(tipo);
  if (tipo && tipo !== "todos" && !tipoFilter) redirect("/servicios");

  if (usesServiciosBandeja(session.role)) {
    return (
      <ServiciosTecnicoBandeja
        companyId={session.activeCompanyId}
        userId={session.userId}
        technician={session.role === "TECNICO"}
        vista={parseServiciosVista(vista)}
        tipo={tipo}
        estado={estado}
        query={query}
        desde={desde}
        hasta={hasta}
      />
    );
  }

  const equipmentScope = await equipmentScopeForServicios(session);
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const canOpenOperacion = can(session.role, "operation.queue", session.activeCompanyCode);

  const rows = await prisma.attention.findMany({
    where: {
      ...(tipoFilter ? { attentionType: tipoFilter } : {}),
      ...(estado === "espera_ingreso" ? { status: "ABIERTA" } : {}),
      ...(estado === "en_proceso" ? { status: { not: "ABIERTA" } } : {}),
      ...(query
        ? {
            OR: [
              { equipment: { folio: { contains: query } } },
              { equipment: { client: { name: { contains: query } } } },
              { reportedFault: { contains: query } },
            ],
          }
        : {}),
      equipment: equipmentScope,
    },
    include: {
      equipment: { include: { client: true, originCompany: true } },
      technicalCases: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const caseIds = rows.flatMap((row) => row.technicalCases.map((c) => c.id));
  const quotes = caseIds.length
    ? await prisma.quote.findMany({
        where: { companyId: session.activeCompanyId, technicalCaseId: { in: caseIds } },
        select: { id: true, folio: true, technicalCaseId: true },
      })
    : [];
  const quoteByCase = new Map(quotes.map((quote) => [quote.technicalCaseId!, quote]));

  const navBase = { tipo: tipo ?? "todos", estado: estado ?? "todos", q: query };
  const subtitle =
    session.role === "VENTAS"
      ? "Atenciones de tu cartera. Filtra por tipo y estado; abre equipo, operación o cotización."
      : "Atenciones de esta empresa. El ingreso físico se confirma en Almacén o Custodia.";

  return (
    <>
      <PageHeader
        title="Servicios"
        subtitle={subtitle}
        action={
          can(session.role, "attention.create", session.activeCompanyCode) ? (
            <ActionLink href="/servicios/nuevo">Nuevo servicio</ActionLink>
          ) : null
        }
      />
      <SegmentedNav
        items={[
          { href: serviciosListHref({ ...navBase, tipo: "todos" }), label: "Todos los tipos", active: !tipo || tipo === "todos" },
          ...SERVICIO_TIPO_OPTIONS.map((opt) => ({
            href: serviciosListHref({ ...navBase, tipo: opt.param }),
            label: opt.label,
            active: tipo === opt.param,
          })),
        ]}
      />
      <SegmentedNav
        items={[
          { href: serviciosListHref({ ...navBase, estado: "todos" }), label: "Todos los estados", active: !estado || estado === "todos" },
          { href: serviciosListHref({ ...navBase, estado: "espera_ingreso" }), label: "Espera ingreso", active: estado === "espera_ingreso" },
          { href: serviciosListHref({ ...navBase, estado: "en_proceso" }), label: "En proceso", active: estado === "en_proceso" },
        ]}
      />
      <FilterBar action="/servicios">
        {tipo && tipo !== "todos" ? <input type="hidden" name="tipo" value={tipo} /> : null}
        {estado && estado !== "todos" ? <input type="hidden" name="estado" value={estado} /> : null}
        <input name="q" defaultValue={query} placeholder="Folio, cliente o falla" className={`${controlClass} sm:flex-1`} />
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>

      {rows.length === 0 ? (
        <Empty
          title={query ? "Sin coincidencias" : "Sin servicios"}
          body={
            query
              ? `Nada coincide con «${query}».`
              : "Abre un servicio nuevo o ajusta los filtros. Puedes dar de alta cliente y equipo en el alta."
          }
          action={
            query ? (
              <TextLink href={serviciosListHref({ tipo, estado })}>Quitar búsqueda</TextLink>
            ) : can(session.role, "attention.create", session.activeCompanyCode) ? (
              <TextLink href="/servicios/nuevo">Nuevo servicio</TextLink>
            ) : undefined
          }
        />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Tipo</Th>
                  <Th>Equipo</Th>
                  <Th>Cliente</Th>
                  <Th>Prioridad</Th>
                  <Th>Estado</Th>
                  <Th>Operación</Th>
                  <Th>Cotización</Th>
                  <Th>Alta</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const intercompany =
                    session.activeCompanyCode === "SERVOMOTORES" && row.equipment.originCompany.code === "SYSTRON";
                  const equipHref =
                    row.equipment.kind === "MOT" ? `/motores/${row.equipmentId}` : `/equipos/${row.equipmentId}`;
                  const activeCase =
                    row.technicalCases.find((c) => !CLOSED_CASE.includes(c.status as (typeof CLOSED_CASE)[number])) ??
                    row.technicalCases[0];
                  const quote = activeCase ? quoteByCase.get(activeCase.id) : undefined;
                  return (
                    <tr key={row.id}>
                      <Td>
                        <Badge>{servicioTipoLabel(row.attentionType)}</Badge>
                      </Td>
                      <Td>
                        <Link href={equipHref} className="font-medium text-[var(--accent)]">
                          {row.equipment.folio}
                        </Link>
                      </Td>
                      <Td>
                        {intercompany ? (
                          "SYSTRON · intercompañía"
                        ) : (
                          <ClientNameLink
                            clientId={row.equipment.client.id}
                            name={row.equipment.client.name}
                            isSystem={row.equipment.client.isSystem}
                            canEdit={canEditClient}
                          />
                        )}
                      </Td>
                      <Td>{row.priorityName}</Td>
                      <Td>
                        <Badge>{attentionStatusLabel(row.status)}</Badge>
                      </Td>
                      <Td>
                        {activeCase ? (
                          canOpenOperacion ? (
                            <Link href={`/operacion/${activeCase.id}`} className="text-[var(--accent)]">
                              {activeCase.folio}
                            </Link>
                          ) : (
                            activeCase.folio
                          )
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        {quote ? (
                          <Link href={`/cotizaciones/${quote.id}`} className="text-[var(--accent)]">
                            {quote.folio}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        <span className="text-[var(--muted)]">
                          {row.createdAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => {
            const intercompany =
              session.activeCompanyCode === "SERVOMOTORES" && row.equipment.originCompany.code === "SYSTRON";
            const equipHref = row.equipment.kind === "MOT" ? `/motores/${row.equipmentId}` : `/equipos/${row.equipmentId}`;
            const activeCase =
              row.technicalCases.find((c) => !CLOSED_CASE.includes(c.status as (typeof CLOSED_CASE)[number])) ??
              row.technicalCases[0];
            const quote = activeCase ? quoteByCase.get(activeCase.id) : undefined;
            return (
              <MobileCard
                key={row.id}
                href={equipHref}
                title={row.equipment.folio}
                meta={<Badge>{attentionStatusLabel(row.status)}</Badge>}
                footer={
                  <>
                    <p>
                      <Badge>{servicioTipoLabel(row.attentionType)}</Badge>
                      {" · "}
                      {row.priorityName}
                    </p>
                    <p className="mt-1">
                      {intercompany ? (
                        "SYSTRON · intercompañía"
                      ) : (
                        <ClientNameLink
                          clientId={row.equipment.client.id}
                          name={row.equipment.client.name}
                          isSystem={row.equipment.client.isSystem}
                          canEdit={canEditClient}
                        />
                      )}
                    </p>
                    {activeCase || quote ? (
                      <p className="mt-1 text-xs">
                        {activeCase && canOpenOperacion ? (
                          <>
                            Operación{" "}
                            <Link href={`/operacion/${activeCase.id}`} className="text-[var(--accent)]">
                              {activeCase.folio}
                            </Link>
                          </>
                        ) : null}
                        {activeCase && quote ? " · " : null}
                        {quote ? (
                          <>
                            Cotización{" "}
                            <Link href={`/cotizaciones/${quote.id}`} className="text-[var(--accent)]">
                              {quote.folio}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </>
                }
              >
                <p className="line-clamp-2">{row.reportedFault}</p>
              </MobileCard>
            );
          })}
        />
      )}
      <ListCap shown={rows.length} />
    </>
  );
}
