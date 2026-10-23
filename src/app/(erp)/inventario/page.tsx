import { redirect } from "next/navigation";
import { InventoryPartCreateFields } from "@/components/inventory-part-create-fields";
import { InventarioFilters } from "@/components/inventario-filters";
import { createPartAction, stockAction } from "./actions";
import {
  ActiveFilters,
  Badge,
  Button,
  controlClass,
  Empty,
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
  fetchInventoryPartsForList,
  INVENTORY_SEARCH_LIMIT,
  INVENTORY_SEARCH_MIN_LEN,
  inventoryListHasCriteria,
  inventoryListHref,
  listTopInventoryFamilies,
  listTopInventoryRacks,
  loadInventoryCreateCatalog,
  parseInventoryStockFilter,
  partInventoryAvailableQty,
  type InventoryListFilters,
} from "@/lib/inventory-search";
import { formatUbicacion } from "@/lib/inventory-location";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vista?: string; familia?: string; rack?: string; existencia?: string }>;
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

  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const family = (params.familia ?? "").trim();
  const rack = (params.rack ?? "").trim();
  const stock = parseInventoryStockFilter(params.existencia, params.vista);

  const filters: InventoryListFilters = { query, family, rack, stock };
  const hasCriteria = inventoryListHasCriteria(filters);

  const [total, families, racks, createCatalog, parts] = await Promise.all([
    prisma.part.count({ where: { companyId: company.id, active: true } }),
    listTopInventoryFamilies(prisma, company.id),
    listTopInventoryRacks(prisma, company.id),
    loadInventoryCreateCatalog(prisma, company.id),
    hasCriteria ? fetchInventoryPartsForList(prisma, company.id, filters) : Promise.resolve([]),
  ]);

  const showTable = hasCriteria;
  const listNote = !showTable
    ? null
    : parts.length >= INVENTORY_SEARCH_LIMIT
      ? `Hasta ${INVENTORY_SEARCH_LIMIT} líneas. Afina filtros o exporta el CSV.`
      : `${parts.length} línea(s) de ${total.toLocaleString("es-MX")} en catálogo.`;

  const baseFilters = { query, family, rack, stock };
  const clearOne = (omit: "query" | "family" | "rack" | "stock") => {
    const next = { ...baseFilters };
    if (omit === "query") next.query = "";
    if (omit === "family") next.family = "";
    if (omit === "rack") next.rack = "";
    if (omit === "stock") next.stock = "";
    return inventoryListHref(next);
  };

  const stockLabel =
    stock === "bajo_minimo"
      ? "Bajo mínimo"
      : stock === "disponible"
        ? "Con disponible"
        : stock === "cero"
          ? "Sin existencia"
          : null;

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle={`${total.toLocaleString("es-MX")} líneas en catálogo · busca o filtra por familia y ubicación.`}
      />
      <InventarioFilters query={query} family={family} rack={rack} stock={stock} families={families} racks={racks} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextLink href="/inventario/export" className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium no-underline hover:bg-[#f7f8f9]">
          Exportar CSV
        </TextLink>
      </div>
      <ActiveFilters
        items={[
          ...(family ? [{ label: `Familia: ${family}`, clearHref: clearOne("family") }] : []),
          ...(rack ? [{ label: `Rack: ${rack}`, clearHref: clearOne("rack") }] : []),
          ...(stockLabel ? [{ label: stockLabel, clearHref: clearOne("stock") }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: clearOne("query") }] : []),
        ]}
      />
      {!showTable ? (
        <Empty
          title="Busca o elige una familia"
          body={`El catálogo no se lista completo (${total.toLocaleString("es-MX")} líneas). Escribe al menos ${INVENTORY_SEARCH_MIN_LEN} caracteres, elige una familia arriba o combina filtros en la barra.`}
        />
      ) : parts.length === 0 ? (
        <Empty
          title="Sin coincidencias"
          body="Ninguna línea coincide con los filtros actuales."
          action={<TextLink href="/inventario">Limpiar todo</TextLink>}
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
                        <Td>
                          {part.family ? (
                            <TextLink href={inventoryListHref({ ...baseFilters, family: part.family })}>{part.family}</TextLink>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td>
                          {part.rack ? (
                            <TextLink href={inventoryListHref({ ...baseFilters, rack: part.rack })}>{part.rack}</TextLink>
                          ) : (
                            "—"
                          )}
                        </Td>
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
                    {part.family ? (
                      <>
                        <TextLink href={inventoryListHref({ family: part.family })}>{part.family}</TextLink>
                        {" · "}
                      </>
                    ) : null}
                    {[part.catalogNumero && `Núm. ${part.catalogNumero}`, formatUbicacion(part.rack, part.nivel), part.mountType].filter(Boolean).join(" · ")}
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
        <FormSection
          title="Nueva línea de inventario"
          description="Usa los listados del inventario importado; «Otro» solo si el valor no existe en catálogo."
          columns={1}
        >
          <InventoryPartCreateFields catalog={createCatalog} />
        </FormSection>
        <FormActions note="La existencia inicial sigue en cero hasta un movimiento de entrada.">
          <Button type="submit">Agregar al catálogo</Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
