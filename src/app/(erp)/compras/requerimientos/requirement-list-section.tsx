"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addToShoppingListOverlayAction,
  purchaseRequirementOverlayAction,
  type RequirementOverlayState,
} from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { ExpenseCategorySubcategoryFields } from "@/components/expense-category-subcategory-fields";
import { ShoppingListSelection } from "@/components/shopping-list-selection";
import { SlaCountdown } from "@/components/sla-countdown";
import { SupplierPicker } from "@/components/supplier-picker";
import {
  Button,
  controlClass,
  Field,
  FormActions,
  FormSection,
  MoneyInput,
  RecordLink,
  Table,
  TableActionLink,
  Td,
  Th,
} from "@/components/ui";
import type { ExpenseCategoryCatalogItem } from "@/lib/expense-catalog";
import type { RequirementListContext } from "@/lib/requirement-list-enrichment";
import { requirementPartidaLabel, requirementPartNumberRequired } from "@/lib/requirement-display";
import type { PickerOption } from "@/components/searchable-entity-picker";

export type RequirementListRow = {
  id: string;
  quantity: number;
  partNumber: string;
  description: string;
  kind: string;
  status: string;
  requesterName: string;
  shoppingListId: string | null;
  purchaseId: string | null;
  context: RequirementListContext;
};

type ShoppingListOption = {
  id: string;
  folio: string;
  supplierId: string | null;
  supplierName: string | null;
};

const overlayInitial: RequirementOverlayState = { status: "idle" };

function TableActionButton({
  children,
  tone = "ghost",
  onClick,
}: {
  children: React.ReactNode;
  tone?: "primary" | "ghost";
  onClick: () => void;
}) {
  const styles = tone === "primary"
    ? "bg-[var(--accent)] text-white hover:opacity-90"
    : "border border-[var(--line)] bg-white text-[var(--accent)] hover:border-[#91b7cf] hover:bg-[#f4f9fc]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-9 items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 ${styles}`}
    >
      {children}
    </button>
  );
}

function ContextLink({ label, href }: { label: string; href: string | null }) {
  if (!href || label === "—") return <span>{label}</span>;
  return <RecordLink href={href}>{label}</RecordLink>;
}

export function RequirementListSection({
  title,
  rows,
  canManage,
  suppliers,
  categories,
  accounts,
  allowQuickSupplier,
  shoppingLists,
}: {
  title: string;
  rows: RequirementListRow[];
  canManage: boolean;
  suppliers: PickerOption[];
  categories: ExpenseCategoryCatalogItem[];
  accounts: Array<{ id: string; name: string }>;
  allowQuickSupplier: boolean;
  shoppingLists: ShoppingListOption[];
}) {
  const [purchaseRow, setPurchaseRow] = useState<RequirementListRow | null>(null);
  const [listRow, setListRow] = useState<RequirementListRow | null>(null);

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <h2 className="border-b border-[var(--line)] px-4 py-3 text-sm font-semibold">{title}</h2>
      <Table>
        <thead>
          <tr>
            <Th>Cantidad</Th>
            <Th>Partida</Th>
            <Th>Diag</Th>
            <Th>OS</Th>
            <Th>Equipo</Th>
            <Th>Solicitante</Th>
            <Th>SLA</Th>
            {canManage ? <Th>Acciones</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>{row.quantity}</Td>
              <Td>{requirementPartidaLabel(row)}</Td>
              <Td><ContextLink label={row.context.diagLabel} href={row.context.diagHref} /></Td>
              <Td><ContextLink label={row.context.osLabel} href={row.context.osHref} /></Td>
              <Td><ContextLink label={row.context.equipmentLabel} href={row.context.equipmentHref} /></Td>
              <Td>{row.requesterName}</Td>
              <Td><SlaCountdown dueAt={row.context.slaDueAt} /></Td>
              {canManage ? (
                <Td className="flex flex-wrap gap-2">
                  {row.status === "PENDIENTE" ? (
                    <>
                      <TableActionButton tone="primary" onClick={() => setPurchaseRow(row)}>Comprar</TableActionButton>
                      <TableActionButton onClick={() => setListRow(row)}>Agregar a lista</TableActionButton>
                    </>
                  ) : row.shoppingListId ? (
                    <TableActionLink href={`/compras/listas/${row.shoppingListId}`}>Ver lista</TableActionLink>
                  ) : row.purchaseId ? (
                    <TableActionLink href={`/compras/${row.purchaseId}`}>Ver compra</TableActionLink>
                  ) : null}
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
      {purchaseRow ? (
        <RequirementPurchaseDialog
          row={purchaseRow}
          suppliers={suppliers}
          categories={categories}
          accounts={accounts}
          allowQuickSupplier={allowQuickSupplier}
          onClose={() => setPurchaseRow(null)}
        />
      ) : null}
      {listRow ? (
        <RequirementAddToListDialog
          row={listRow}
          shoppingLists={shoppingLists}
          suppliers={suppliers}
          allowQuickSupplier={allowQuickSupplier}
          onClose={() => setListRow(null)}
        />
      ) : null}
    </section>
  );
}

function RequirementPurchaseDialog({
  row,
  suppliers,
  categories,
  accounts,
  allowQuickSupplier,
  onClose,
}: {
  row: RequirementListRow;
  suppliers: PickerOption[];
  categories: ExpenseCategoryCatalogItem[];
  accounts: Array<{ id: string; name: string }>;
  allowQuickSupplier: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(purchaseRequirementOverlayAction, overlayInitial);
  const refaccion = row.kind === "REFACCION";

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <FormOverlayDialog open onClose={onClose} title="Comprar requerimiento" titleId="requirement-purchase-dialog" wide>
      <p className="mb-4 text-sm text-[var(--muted)]">
        {refaccion
          ? `${row.partNumber || requirementPartidaLabel(row)} × ${row.quantity}. Se conserva el detalle técnico.`
          : "Completa solo los datos financieros de la compra."}
      </p>
      <form action={formAction}>
        <input type="hidden" name="requirementId" value={row.id} />
        <FormSection title="Datos de compra" description="La moneda se hereda del proveedor.">
          <div className="md:col-span-2">
            <SupplierPicker suppliers={suppliers} required allowQuickSupplier={allowQuickSupplier} />
          </div>
          <Field label="Fecha de compra">
            <input name="purchaseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={controlClass} />
          </Field>
          <Field label="Monto">
            <MoneyInput name="amount" min="0.01" required />
          </Field>
          {refaccion ? (
            <div className="md:col-span-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm">
              <span className="text-[var(--muted)]">Clasificación de egreso</span>
              <strong className="ml-2">Producción y operación · Refacciones y componentes</strong>
            </div>
          ) : (
            <ExpenseCategorySubcategoryFields categories={categories} />
          )}
          <Field label="Descripción general">
            <input
              name="concept"
              required
              defaultValue={refaccion ? "Compra de refacciones y componentes" : row.description || row.partNumber}
              className={controlClass}
            />
          </Field>
          <Field label="Forma de pago">
            <select name="paymentType" defaultValue="CONTADO" className={controlClass}>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </Field>
          <Field label="Banco / cuenta, si aplica">
            <select name="accountId" defaultValue="" className={controlClass}>
              <option value="">No aplica</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </Field>
        </FormSection>
        {state.status === "error" ? (
          <p className="px-5 pt-4 text-sm text-[var(--danger)]" role="alert">{state.message}</p>
        ) : null}
        <FormActions>
          <Button type="button" tone="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Registrar compra"}</Button>
        </FormActions>
      </form>
    </FormOverlayDialog>
  );
}

function RequirementAddToListDialog({
  row,
  shoppingLists,
  suppliers,
  allowQuickSupplier,
  onClose,
}: {
  row: RequirementListRow;
  shoppingLists: ShoppingListOption[];
  suppliers: PickerOption[];
  allowQuickSupplier: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(addToShoppingListOverlayAction, overlayInitial);
  const partRequired = requirementPartNumberRequired(row.kind);

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <FormOverlayDialog open onClose={onClose} title="Agregar a lista" titleId="requirement-add-list-dialog" wide>
      <p className="mb-4 text-sm text-[var(--muted)]">Ajusta la partida y elige una lista abierta o crea una nueva.</p>
      <form action={formAction}>
        <input type="hidden" name="requirementId" value={row.id} />
        <input type="hidden" name="requirementKind" value={row.kind} />
        <FormSection title="Lista y partida">
          <ShoppingListSelection lists={shoppingLists} suppliers={suppliers} allowQuickSupplier={allowQuickSupplier} />
          <Field label="Número de parte">
            <input name="partNumber" defaultValue={row.partNumber} required={partRequired} className={controlClass} />
          </Field>
          <Field label="Descripción">
            <input name="description" defaultValue={row.description} className={controlClass} />
          </Field>
          <Field label="Cantidad">
            <input name="quantity" type="number" min="1" defaultValue={row.quantity} required className={controlClass} />
          </Field>
        </FormSection>
        {state.status === "error" ? (
          <p className="px-5 pt-4 text-sm text-[var(--danger)]" role="alert">{state.message}</p>
        ) : null}
        <FormActions>
          <Button type="button" tone="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Agregar a lista"}</Button>
        </FormActions>
      </form>
    </FormOverlayDialog>
  );
}
