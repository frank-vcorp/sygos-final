import { redirect } from "next/navigation";
import { createPartAction, stockAction } from "./actions";
import {
  ActionLink,
  ActiveFilters,
  Badge,
  Button,
  controlClass,
  Empty,
  Field,
  FilterBar,
  FormActions,
  FormPanel,
  FormSection,
  ListCap,
  MobileCard,
  PageHeader,
  ResponsiveData,
  Table,
  Td,
  TextLink,
  Th,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import {
  INVENTORY_SEARCH_LIMIT,
  INVENTORY_SEARCH_MIN_LEN,
  partInventoryAvailableQty,
  partInventorySearchWhere,
} from "@/lib/inventory-search";
import { formatUbicacion } from "@/lib/inventory-location";
import { listHref } from "@/lib/list-url";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vista?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "inventory.operate", session.activeCompanyCode)) redirect("/inicio");
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company) redirect("/empresa");
  if (!company.inventoryEnabled) {
    return (
      <>
        <PageHeader title="Inventario" subtitle={company.name} />
        <Empty
          title="Inventario deshabilitado"
          body="Servomotores puede operar sin existencias. Solo el Administrador habilita este inventario, y al hacerlo empieza vacío, separado de SYSTRON."
        />
      </>
    );
  }

  const { q, vista } = await searchParams;
  const query = (q ?? "").trim();
  const belowMinimum = vista === "bajo_minimo";
  const searchWhere = partInventorySearchWhere(company.id, query);

  const total = await prisma.part.count({ where: { companyId: company.id, active: true } });

  let parts: Awaited<ReturnType<typeof prisma.part.findMany>> = [];
  let listNote: string | null = null;

  if (belowMinimum) {
    const ids = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Part
      WHERE companyId = ${company.id}
        AND active = 1
        AND minQty IS NOT NULL
        AND qty < minQty
      ORDER BY qty ASC
      LIMIT ${INVENTORY_SEARCH_LIMIT}
    `;
    if (ids.length > 0) {
      parts = await prisma.part.findMany({
        where: { id: { in: ids.map((row) => row.id) } },
        orderBy: [{ qty: "asc" }, { partNumber: "asc" }],
      });
    }
    listNote = parts.length >= INVENTORY_SEARCH_LIMIT
      ? `Mostrando hasta ${INVENTORY_SEARCH_LIMIT} líneas bajo mínimo. Exporta el CSV para el catálogo completo.`
      : `${parts.length} línea(s) bajo mínimo de ${total} en catálogo.`;
  } else if (searchWhere) {
    parts = await prisma.part.findMany({
      where: searchWhere,
      orderBy: [{ partNumber: "asc" }, { rack: "asc" }, { nivel: "asc" }],
      take: INVENTORY_SEARCH_LIMIT,
    });
    listNote = parts.length >= INVENTORY_SEARCH_LIMIT
      ? `Hasta ${INVENTORY_SEARCH_LIMIT} coincidencias. Afina la búsqueda o exporta el CSV.`
      : `${parts.length} coincidencia(s) de ${total} líneas en catálogo.`;
  }

  const showTable = belowMinimum || Boolean(searchWhere);

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle={`${total.toLocaleString("es-MX")} líneas en catálogo · busca por producto, descripción, familia o ubicación.`}
        action={<ActionLink href="/inventario/conteo" tone="ghost">Conteo físico</ActionLink>}
      />
      <FilterBar action="/inventario">
        <input
          name="q"
          defaultValue={query}
          placeholder="Producto, descripción, familia, núm. catálogo, rack…"
          className={`${controlClass} sm:min-w-[14rem] sm:flex-1`}
          autoFocus={!query && !belowMinimum}
        />
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextLink href="/inventario/export" className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium no-underline hover:bg-[#f7f8f9]">
          Exportar CSV
        </TextLink>
        <TextLink
          href={listHref("/inventario", { vista: "bajo_minimo" })}
          className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium no-underline hover:bg-[#f7f8f9]"
        >
          Bajo mínimo
        </TextLink>
      </div>
      <ActiveFilters
        items={[
          ...(belowMinimum ? [{ label: "Bajo mínimo", clearHref: listHref("/inventario", { q: query || undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: listHref("/inventario", { vista: belowMinimum ? "bajo_minimo" : undefined }) }] : []),
        ]}
      />
      {!showTable ? (
        <Empty
          title="Busca una refacción"
          body={`El catálogo no se lista completo (${total.toLocaleString("es-MX")} líneas). Escribe al menos ${INVENTORY_SEARCH_MIN_LEN} caracteres (con o sin acentos) en producto, descripción, familia o ubicación, o abre «Bajo mínimo» para revisar faltantes.`}
        />
      ) : parts.length === 0 ? (
        <Empty
          title="Sin coincidencias"
          body={belowMinimum ? "Ninguna línea está bajo su mínimo informativo." : `Nada coincide con «${query}».`}
          action={<TextLink href="/inventario">Limpiar búsqueda</TextLink>}
        />
      ) : (
        <>
          {listNote ? <p className="mb-2 text-sm text-[var(--muted)]">{listNote}</p> : null}
          <ListCap shown={parts.length} cap={INVENTORY_SEARCH_LIMIT} />
          <ResponsiveData
            table={
              <Table stickyHeader>
                <thead>
                  <tr>
                    <Th>Producto</Th>
                    <Th>Descripción</Th>
                    <Th>Núm.</Th>
                    <Th>Familia</Th>
                    <Th>Rack</Th>
                    <Th>Nivel</Th>
                    <Th>Montaje</Th>
                    <Th>Existencia</Th>
                    <Th>Mínimo</Th>
                    <Th>Movimiento</Th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((part) => {
                    const available = partInventoryAvailableQty(part);
                    return (
                      <tr key={part.id}>
                        <Td>{part.partNumber}</Td>
                        <Td>{part.description || "—"}</Td>
                        <Td>{part.catalogNumero || "—"}</Td>
                        <Td>{part.family || "—"}</Td>
                        <Td>{part.rack || "—"}</Td>
                        <Td>{part.nivel || "—"}</Td>
                        <Td>{part.mountType || "—"}</Td>
                        <Td>
                          {available}
                          {part.qtyReserved > 0 ? (
                            <span className="ml-1 text-xs text-[var(--muted)]">({part.qty} tot., {part.qtyReserved} apart.)</span>
                          ) : null}
                          {part.minQty != null && available < part.minQty ? <Badge tone="warn">bajo mínimo</Badge> : null}
                          {part.maxQty != null && part.qty > part.maxQty ? <Badge tone="warn">sobre máximo</Badge> : null}
                        </Td>
                        <Td>
                          {part.minQty ?? "—"}
                          {part.maxQty != null ? <span className="ml-1 text-xs text-[var(--muted)]">(máx. {part.maxQty})</span> : null}
                        </Td>
                        <Td>
                          <form action={stockAction} className="flex flex-wrap gap-1">
                            <input type="hidden" name="partId" value={part.id} />
                            <input type="hidden" name="version" value={part.version} />
                            <select name="kind" className="rounded-md border border-[var(--line)] px-2 py-1 text-sm">
                              <option value="ENTRADA">Entrada</option>
                              <option value="SALIDA">Salida</option>
                            </select>
                            <input name="quantity" type="number" min={1} required className="w-16 rounded-md border border-[var(--line)] px-2 py-1 text-sm" />
                            <Button type="submit" tone="ghost">Aplicar</Button>
                          </form>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            }
            cards={parts.map((part) => {
              const available = partInventoryAvailableQty(part);
              return (
                <MobileCard
                  key={part.id}
                  title={part.partNumber}
                  meta={<strong className="text-base text-[#0b1f3a]">{available}</strong>}
                  footer={
                    <form action={stockAction} className="grid grid-cols-[1fr_88px] gap-2">
                      <input type="hidden" name="partId" value={part.id} />
                      <input type="hidden" name="version" value={part.version} />
                      <select name="kind" className={controlClass}>
                        <option value="ENTRADA">Entrada</option>
                        <option value="SALIDA">Salida</option>
                      </select>
                      <input name="quantity" aria-label="Cantidad" type="number" min={1} required className={controlClass} />
                      <Button type="submit" tone="ghost" className="col-span-2">Aplicar movimiento</Button>
                    </form>
                  }
                >
                  <p>{part.description || "Sin descripción"}</p>
                  <p>
                    {[part.catalogNumero && `Núm. ${part.catalogNumero}`, part.family, formatUbicacion(part.rack, part.nivel), part.mountType].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {part.minQty != null && available < part.minQty ? <Badge tone="warn">bajo mínimo</Badge> : null}
                    {part.maxQty != null && part.qty > part.maxQty ? <Badge tone="warn">sobre máximo</Badge> : null}
                    {part.qtyReserved > 0 ? <span className="text-xs text-[var(--muted)]">{part.qtyReserved} apartada(s)</span> : null}
                    <span>
                      Mínimo: {part.minQty ?? "—"}
                      {part.maxQty != null ? ` · Máx. ${part.maxQty}` : ""}
                    </span>
                  </div>
                </MobileCard>
              );
            })}
          />
        </>
      )}
      <FormPanel action={createPartAction} className="mt-4">
        <FormSection title="Nueva línea de inventario" description="Agrega al catálogo sin inventar existencia; el stock entra con movimientos.">
          <Field label="Nombre de producto">
            <input name="partNumber" required className={controlClass} />
          </Field>
          <Field label="Descripción">
            <input name="description" className={controlClass} />
          </Field>
          <Field label="Número (catálogo)">
            <input name="catalogNumero" className={controlClass} />
          </Field>
          <Field label="Familia">
            <input name="family" className={controlClass} />
          </Field>
          <Field label="Rack">
            <input name="rack" className={controlClass} placeholder="2 o ORGANIZADOR GRIS" />
          </Field>
          <Field label="Nivel">
            <input name="nivel" className={controlClass} placeholder="6" />
          </Field>
          <Field label="Unidad">
            <input name="unit" className={controlClass} />
          </Field>
          <Field label="Montaje">
            <input name="mountType" className={controlClass} />
          </Field>
          <Field label="Mínimo informativo">
            <input name="minQty" type="number" min={0} className={controlClass} />
          </Field>
          <Field label="Máximo informativo">
            <input name="maxQty" type="number" min={0} className={controlClass} />
          </Field>
        </FormSection>
        <FormActions note="La existencia inicial sigue en cero hasta un movimiento de entrada.">
          <Button type="submit">Agregar al catálogo</Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
