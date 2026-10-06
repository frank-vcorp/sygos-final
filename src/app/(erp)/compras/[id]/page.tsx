import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cancelOrderAction, changeOrderAction, decideOrderAction, discardDirectAction, editDirectAction, processPurchaseAction } from "../actions";
import { Badge, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { historyFor } from "@/lib/history";
import { formatWhen } from "@/lib/form";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function CompraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.purchase.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { supplier: true },
  });
  if (!row) notFound();
  const accounts = await prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true, kind: { not: "TARJETA" } }, orderBy: { name: "asc" } });
  const suppliers = await prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } });
  const history = await historyFor("COMPRA", row.id);
  const requester = await prisma.user.findUnique({ where: { id: row.requesterUserId }, select: { name: true } });
  const canManage = can(session.role, "finance.manage", session.activeCompanyCode);
  const ready = (row.kind === "DIRECTA" && row.status === "PENDIENTE_VALIDAR") || (row.kind === "OC" && row.status === "AUTORIZADA");
  return (
    <>
      <PageHeader back={{ href: "/compras", label: "Compras" }} title={row.folio} subtitle={row.kind === "OC" ? "Orden de compra" : "Compra directa"} action={<Badge>{row.status}</Badge>} />
      <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
        <p>Proveedor: {row.supplier ? <Link href={`/proveedores/${row.supplier.id}`} className="text-[var(--accent)]">{row.supplier.name}</Link> : "Sin proveedor"}</p>
        <p className="mt-1">Solicitante: {requester?.name ?? "—"}</p>
        <p className="mt-1">{row.concept} · cantidad {row.quantity} · {money(row.amount)}</p>
        {row.authorizedAmount != null ? <p className="mt-1">Importe autorizado: {money(row.authorizedAmount)}</p> : null}
        <p className="mt-1">Destino: {row.destination}{row.destinationRef ? ` · ${row.destinationRef}` : ""}</p>
        {row.settlement ? <p className="mt-1">Procesada como {row.settlement === "CREDITO" ? "cuenta por pagar" : "egreso"}.</p> : null}
        {row.cancelReason ? <p className="mt-1">Cancelación: {row.cancelReason}</p> : null}
      </section>
      {row.kind === "OC" && row.status === "PENDIENTE_AUTORIZACION" && can(session.role, "purchase.authorize", session.activeCompanyCode) ? (
        <form action={decideOrderAction} className="mt-4 flex gap-2">
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <button name="decision" value="si" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Autorizar</button>
          <button name="decision" value="no" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">Rechazar</button>
        </form>
      ) : null}
      {canManage && row.kind === "DIRECTA" && row.status === "PENDIENTE_VALIDAR" ? (
        <form action={editDirectAction} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <Field label="Cuadrar importe"><input name="amount" type="number" min="0.01" step="0.01" defaultValue={row.amount} className={controlClass} /></Field>
          <button className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">Guardar</button>
        </form>
      ) : null}
      {canManage && ready ? (
        <form action={processPurchaseAction} className="mt-4 grid max-w-xl gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Procesar</h2>
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <Field label="Forma">
            <select name="settlement" className={controlClass} defaultValue="CONTADO">
              <option value="CONTADO">Contado, un egreso</option>
              <option value="CREDITO">Crédito, una cuenta por pagar</option>
            </select>
          </Field>
          <Field label="Cuenta, si es contado">
            <select name="accountId" className={controlClass} defaultValue={accounts[0]?.id ?? ""}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </Field>
          <button className="w-fit rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Procesar</button>
        </form>
      ) : null}
      {canManage && row.kind === "OC" && row.status === "AUTORIZADA" ? (
        <form action={changeOrderAction} className="mt-4 grid max-w-xl gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Cambio material</h2>
          <p className="text-sm text-[var(--muted)]">Proveedor, concepto o importe regresan la orden al CEO.</p>
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <Field label="Proveedor">
            <select name="supplierId" className={controlClass} defaultValue={row.supplierId ?? ""}>
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </Field>
          <Field label="Concepto"><input name="concept" defaultValue={row.concept} className={controlClass} /></Field>
          <Field label="Importe"><input name="amount" type="number" step="0.01" defaultValue={row.amount} className={controlClass} /></Field>
          <button className="w-fit rounded-md border border-[var(--line)] px-3 py-2 text-sm">Enviar de nuevo al CEO</button>
        </form>
      ) : null}
      {canManage && row.kind === "DIRECTA" && row.status === "PENDIENTE_VALIDAR" ? (
        <form action={discardDirectAction} className="mt-3">
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <button className="text-sm text-[var(--danger)]">Eliminar y liberar presupuesto</button>
        </form>
      ) : null}
      {canManage && row.kind === "OC" && (row.status === "AUTORIZADA" || row.status === "PENDIENTE_AUTORIZACION") ? (
        <form action={cancelOrderAction} className="mt-3 flex gap-2">
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <input name="reason" required placeholder="Motivo de cancelación" className={controlClass} />
          <button className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">Cancelar</button>
        </form>
      ) : null}
      <ul className="mt-4 space-y-2 text-sm">{history.map((item) => <li key={item.id}><span className="text-[var(--muted)]">{formatWhen(item.createdAt)}</span> · {item.summary}</li>)}</ul>
    </>
  );
}
