import { notFound, redirect } from "next/navigation";
import { cancelOrderAction, changeOrderAction, decideOrderAction, discardDirectAction, editDirectAction, processPurchaseAction } from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { SupplierPicker } from "@/components/supplier-picker";
import {
  Badge,
  Button,
  controlClass,
  DetailAnchorButton,
  EntityDetailHeader,
  EntityMetaItem,
  Field,
  TextLink,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { historyFor } from "@/lib/history";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_VALIDAR: "Pendiente de validar",
  PENDIENTE_AUTORIZACION: "Pendiente de autorización",
  AUTORIZADA: "Autorizada",
  RECHAZADA: "Rechazada",
  PROCESADA: "Procesada",
  CANCELADA: "Cancelada",
  ELIMINADA: "Eliminada",
};

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
  const canAuthorize = can(session.role, "purchase.authorize", session.activeCompanyCode);
  const ready = (row.kind === "DIRECTA" && row.status === "PENDIENTE_VALIDAR") || (row.kind === "OC" && row.status === "AUTORIZADA");

  let primaryAction: React.ReactNode = null;
  if (row.kind === "OC" && row.status === "PENDIENTE_AUTORIZACION" && canAuthorize) {
    primaryAction = (
      <form action={decideOrderAction} className="inline">
        <input type="hidden" name="purchaseId" value={row.id} />
        <input type="hidden" name="version" value={row.version} />
        <Button type="submit" name="decision" value="si">Autorizar O.C.</Button>
      </form>
    );
  } else if (canManage && ready) {
    primaryAction = <DetailAnchorButton href="#procesar-compra">Procesar compra</DetailAnchorButton>;
  } else if (canManage && row.kind === "DIRECTA" && row.status === "PENDIENTE_VALIDAR") {
    primaryAction = <DetailAnchorButton href="#cuadrar-compra">Cuadrar importe</DetailAnchorButton>;
  }

  const secondaryActions =
    row.kind === "OC" && row.status === "PENDIENTE_AUTORIZACION" && canAuthorize ? (
      <form action={decideOrderAction} className="inline">
        <input type="hidden" name="purchaseId" value={row.id} />
        <input type="hidden" name="version" value={row.version} />
        <Button type="submit" name="decision" value="no" tone="ghost">Rechazar</Button>
      </form>
    ) : null;

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/compras", label: "Compras" }}
        title={row.folio}
        subtitle={row.kind === "OC" ? "Orden de compra" : "Compra directa"}
        status={<Badge tone={row.status === "PENDIENTE_AUTORIZACION" || row.status === "PENDIENTE_VALIDAR" ? "warn" : "neutral"}>{STATUS_LABEL[row.status] ?? row.status}</Badge>}
        meta={
          <>
            <EntityMetaItem label="Proveedor">
              {row.supplier ? <TextLink href={`/proveedores/${row.supplier.id}`}>{row.supplier.name}</TextLink> : "Sin proveedor"}
            </EntityMetaItem>
            <EntityMetaItem label="Importe">{money(row.amount)}</EntityMetaItem>
            <EntityMetaItem label="Destino">
              {row.destination}
              {row.destinationRef ? ` · ${row.destinationRef}` : ""}
            </EntityMetaItem>
            <EntityMetaItem label="Solicitante">{requester?.name ?? "—"}</EntityMetaItem>
            <EntityMetaItem label="Concepto">{row.concept}</EntityMetaItem>
            <EntityMetaItem label="Cantidad">{row.quantity}</EntityMetaItem>
          </>
        }
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
      <section className="mb-4 rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
        {row.authorizedAmount != null ? <p>Importe autorizado: {money(row.authorizedAmount)}</p> : null}
        {row.settlement ? <p className={row.authorizedAmount != null ? "mt-1" : ""}>Procesada como {row.settlement === "CREDITO" ? "cuenta por pagar" : "egreso"}.</p> : null}
        {row.cancelReason ? <p className="mt-1">Cancelación: {row.cancelReason}</p> : null}
      </section>
      {canManage && row.kind === "DIRECTA" && row.status === "PENDIENTE_VALIDAR" ? (
        <form id="cuadrar-compra" action={editDirectAction} className="scroll-mt-24 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <Field label="Cuadrar importe"><input name="amount" type="number" min="0.01" step="0.01" defaultValue={row.amount} className={controlClass} /></Field>
          <Button type="submit" tone="ghost">Guardar importe</Button>
        </form>
      ) : null}
      {canManage && ready ? (
        <form id="procesar-compra" action={processPurchaseAction} className="mt-4 grid max-w-xl scroll-mt-24 gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Procesar compra</h2>
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
          <Button type="submit">Procesar compra</Button>
        </form>
      ) : null}
      {canManage && row.kind === "OC" && row.status === "AUTORIZADA" ? (
        <form action={changeOrderAction} className="mt-4 grid max-w-xl gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Cambio material</h2>
          <p className="text-sm text-[var(--muted)]">Proveedor, concepto o importe regresan la orden al CEO.</p>
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <SupplierPicker
            suppliers={suppliers}
            defaultSupplierId={row.supplierId ?? ""}
            allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
            allowEmpty
            emptyLabel="Sin proveedor"
          />
          <Field label="Concepto"><input name="concept" defaultValue={row.concept} className={controlClass} /></Field>
          <Field label="Importe"><input name="amount" type="number" step="0.01" defaultValue={row.amount} className={controlClass} /></Field>
          <Button type="submit" tone="ghost">Enviar de nuevo al CEO</Button>
        </form>
      ) : null}
      {canManage && row.kind === "DIRECTA" && row.status === "PENDIENTE_VALIDAR" ? (
        <form action={discardDirectAction} className="mt-3">
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <button type="submit" className="text-sm text-[var(--danger)]">Eliminar y liberar presupuesto</button>
        </form>
      ) : null}
      {canManage && row.kind === "OC" && (row.status === "AUTORIZADA" || row.status === "PENDIENTE_AUTORIZACION") ? (
        <form action={cancelOrderAction} className="mt-3 flex flex-wrap gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <input type="hidden" name="purchaseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <input name="reason" required placeholder="Motivo de cancelación" className={`${controlClass} min-w-[12rem] flex-1`} />
          <Button type="submit" tone="ghost">Cancelar orden</Button>
        </form>
      ) : null}
      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
