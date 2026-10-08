import Link from "next/link";
import { redirect } from "next/navigation";
import { createPartAction, stockAction } from "./actions";
import { ActionLink, Badge, Button, controlClass, Empty, Field, PageHeader, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatUbicacion } from "@/lib/inventory-location";
import { requireCompany } from "@/lib/session";

export default async function InventarioPage() {
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
  const parts = await prisma.part.findMany({
    where: { companyId: company.id, active: true },
    orderBy: [{ rack: "asc" }, { nivel: "asc" }, { partNumber: "asc" }],
    take: 500,
  });
  const total = await prisma.part.count({ where: { companyId: company.id, active: true } });
  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle={`Piezas de ${company.name}. Existencia = stock actual del Excel; mínimo = stock mínimo (el catálogo no trae máximo).`}
        action={<ActionLink href="/inventario/conteo" tone="ghost">Conteo físico</ActionLink>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <a href="/inventario/export" className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium">Exportar</a>
        {total > parts.length ? (
          <span className="text-sm text-[var(--muted)]">Mostrando {parts.length} de {total}. Exporta el CSV para ver todo.</span>
        ) : (
          <span className="text-sm text-[var(--muted)]">{total} líneas</span>
        )}
      </div>
      {parts.length === 0 ? (
        <Empty title="Sin refacciones" body="El catálogo empieza vacío. Una parte nueva no inventa existencia." />
      ) : (
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
                {parts.map((part) => (
                  <tr key={part.id}>
                    <Td>{part.partNumber}</Td>
                    <Td>{part.description || "—"}</Td>
                    <Td>{part.catalogNumero || "—"}</Td>
                    <Td>{part.family || "—"}</Td>
                    <Td>{part.rack || "—"}</Td>
                    <Td>{part.nivel || "—"}</Td>
                    <Td>{part.mountType || "—"}</Td>
                    <Td>
                      {part.qty}
                      {part.minQty != null && part.qty < part.minQty ? <Badge tone="warn">bajo mínimo</Badge> : null}
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
                        <Button type="submit" tone="ghost">
                          Aplicar
                        </Button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={parts.map((part) => (
            <article key={part.id} className="rounded-lg border border-[var(--line)] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{part.partNumber}</h2>
                  <p className="text-sm text-[var(--muted)]">{part.description || "Sin descripción"}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {[part.catalogNumero && `Núm. ${part.catalogNumero}`, part.family, formatUbicacion(part.rack, part.nivel), part.mountType].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <strong>{part.qty}</strong>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {part.minQty != null && part.qty < part.minQty ? <Badge tone="warn">bajo mínimo</Badge> : null}
                {part.maxQty != null && part.qty > part.maxQty ? <Badge tone="warn">sobre máximo</Badge> : null}
                <span className="text-xs text-[var(--muted)]">
                  Mínimo: {part.minQty ?? "—"}
                  {part.maxQty != null ? ` · Máx. ${part.maxQty}` : ""}
                </span>
              </div>
              <form action={stockAction} className="mt-3 grid grid-cols-[1fr_88px] gap-2">
                <input type="hidden" name="partId" value={part.id} />
                <input type="hidden" name="version" value={part.version} />
                <select name="kind" className={controlClass}>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                </select>
                <input name="quantity" aria-label="Cantidad" type="number" min={1} required className={controlClass} />
                <Button type="submit" tone="ghost" className="col-span-2">
                  Aplicar movimiento
                </Button>
              </form>
            </article>
          ))}
        />
      )}
      <form action={createPartAction} className="mt-4 grid max-w-xl gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <h2 className="font-medium">Nueva línea de inventario</h2>
        <Field label="Nombre de producto">
          <input name="partNumber" required className={controlClass} />
        </Field>
        <Field label="Descripción">
          <input name="description" className={controlClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mínimo informativo">
            <input name="minQty" type="number" min={0} className={controlClass} />
          </Field>
          <Field label="Máximo informativo">
            <input name="maxQty" type="number" min={0} className={controlClass} />
          </Field>
        </div>
        <Button type="submit">Agregar al catálogo</Button>
      </form>
    </>
  );
}
