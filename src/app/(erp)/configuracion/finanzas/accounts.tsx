"use client";

import { deleteFinanceAccountAction, updateFinanceAccountAction } from "../ceo-actions";
import { ConfigEditDialog } from "../edit-dialog";
import { ConfirmSubmit } from "@/components/submit-button";
import { financeAccountDeleteConfirm } from "@/lib/finance-account-ui";
import { matchesText } from "../filters";
import { HiddenFields } from "../pieces";
import {
  ActiveFilters,
  Button,
  controlClass,
  Empty,
  Field,
  FilterBar,
  FormActions,
  FormPanel,
  FormSection,
  MobileCard,
  ResponsiveData,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { accountKindLabel } from "@/lib/ceo-config";
import { financeAccountDisplayName, isBankAccountKind, isCashAccountKind, isCreditCardAccountKind, normalizeFinanceAccountKind } from "@/lib/finance-accounts";
import { listHref } from "@/lib/list-url";
import { money } from "@/lib/money";

type AccountRow = {
  id: string;
  name: string;
  kind: string;
  bankName: string | null;
  clabe: string | null;
  lastFour: string | null;
  balance: number;
};

export function AccountsPanel({
  accounts,
  q,
  tipo,
}: {
  accounts: AccountRow[];
  q: string;
  tipo: string;
}) {
  const kind =
    tipo === "BANCARIA" || tipo === "BANCO"
      ? "BANCARIA"
      : tipo === "EFECTIVO"
        ? "EFECTIVO"
        : tipo === "CREDITO" || tipo === "TARJETA"
          ? "CREDITO"
          : "";
  const visible = accounts.filter((account) => {
    if (kind && normalizeFinanceAccountKind(account.kind) !== kind) return false;
    const label = financeAccountDisplayName(account);
    return matchesText(q, [label, account.name, account.bankName, account.clabe, account.lastFour, accountKindLabel(account.kind)]);
  });

  return (
    <>
      <FilterBar action="/configuracion/finanzas">
        <input type="hidden" name="vista" value="cuentas" />
        <input name="q" defaultValue={q} placeholder="Nombre, banco o CLABE" className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} />
        <select name="tipo" defaultValue={kind} className={`${controlClass} sm:w-auto`}>
          <option value="">Todos los tipos</option>
          <option value="BANCARIA">Bancaria</option>
          <option value="EFECTIVO">Efectivo</option>
          <option value="CREDITO">Crédito (tarjeta)</option>
        </select>
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(kind ? [{ label: accountKindLabel(kind), clearHref: listHref("/configuracion/finanzas", { vista: "cuentas", q: q || undefined }) }] : []),
          ...(q ? [{ label: `Búsqueda: ${q}`, clearHref: listHref("/configuracion/finanzas", { vista: "cuentas", tipo: kind || undefined }) }] : []),
        ]}
      />
      {accounts.length === 0 ? (
        <Empty title="Sin cuentas" body="Crea la primera cuenta con el botón del encabezado. Las que ya existen siguen en esta lista." />
      ) : visible.length === 0 ? (
        <Empty title="Sin coincidencias" body="Ninguna cuenta coincide con el filtro." />
      ) : (
        <ResponsiveData
          table={
            <Table stickyHeader>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Tipo</Th>
                  <Th>Banco</Th>
                  <Th>CLABE</Th>
                  <Th>Últimos 4</Th>
                  <Th>Saldo</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((account) => {
                  const label = financeAccountDisplayName(account);
                  return (
                    <tr key={account.id}>
                      <Td className="font-semibold text-slate-900">{label}</Td>
                      <Td>{accountKindLabel(account.kind)}</Td>
                      <Td>{account.bankName || "—"}</Td>
                      <Td>{account.clabe || "—"}</Td>
                      <Td>{account.lastFour || "—"}</Td>
                      <Td>{money(account.balance)}</Td>
                      <Td>
                        <ConfigEditDialog title={`Editar ${label}`} titleId={`editar-cuenta-${account.id}`}>
                          <AccountEditor account={account} q={q} tipo={kind} />
                        </ConfigEditDialog>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={visible.map((account) => {
            const label = financeAccountDisplayName(account);
            return (
              <MobileCard
                key={account.id}
                title={label}
                meta={<span className="text-[var(--muted)]">{accountKindLabel(account.kind)}</span>}
                footer={
                  <div className="flex justify-end">
                    <ConfigEditDialog title={`Editar ${label}`} titleId={`editar-cuenta-m-${account.id}`}>
                      <AccountEditor account={account} q={q} tipo={kind} />
                    </ConfigEditDialog>
                  </div>
                }
              >
                <p>{accountKindLabel(account.kind)}</p>
                <p className="mt-1">Saldo {money(account.balance)}</p>
              </MobileCard>
            );
          })}
        />
      )}
    </>
  );
}

function AccountEditor({ account, q, tipo }: { account: AccountRow; q: string; tipo: string }) {
  const label = financeAccountDisplayName(account);
  const kind = normalizeFinanceAccountKind(account.kind);
  return (
    <div className="space-y-3">
      <FormPanel action={updateFinanceAccountAction} className="max-w-none border-0 shadow-none">
        <HiddenFields fields={{ accountId: account.id, q, tipo }} />
        <FormSection
          title={label}
          description={`${accountKindLabel(account.kind)} · Saldo ${money(account.balance)}. El saldo no se edita aquí.`}
          columns={1}
        >
          {isCashAccountKind(kind) ? (
            <Field label="Nombre">
              <input name="cashName" defaultValue={account.name} className={controlClass} />
            </Field>
          ) : null}
          {isBankAccountKind(kind) || isCreditCardAccountKind(kind) ? (
            <>
              <Field label="Banco">
                <input name="bankName" required defaultValue={account.bankName ?? ""} className={controlClass} />
              </Field>
              {isBankAccountKind(kind) ? (
                <Field label="CLABE">
                  <input name="clabe" required defaultValue={account.clabe ?? ""} inputMode="numeric" autoComplete="off" className={controlClass} />
                </Field>
              ) : null}
              <Field label="Últimos 4">
                <input name="lastFour" defaultValue={account.lastFour ?? ""} inputMode="numeric" maxLength={4} className={controlClass} />
              </Field>
            </>
          ) : null}
        </FormSection>
        <FormActions>
          <Button type="submit">Guardar cuenta</Button>
        </FormActions>
      </FormPanel>
      <form action={deleteFinanceAccountAction} className="flex justify-end">
        <HiddenFields fields={{ accountId: account.id, q, tipo }} />
        <ConfirmSubmit message={financeAccountDeleteConfirm(label, account.balance)} pendingLabel="Eliminando…">Eliminar</ConfirmSubmit>
      </form>
    </div>
  );
}
