import { deleteFinanceAccountAction, updateFinanceAccountAction } from "../ceo-actions";
import { ConfirmSubmit } from "@/components/submit-button";
import { financeAccountDeleteConfirm } from "@/lib/finance-account-ui";
import { matchesText } from "../filters";
import { EditorPlaceholder, HiddenFields, MasterDetail, SelectLink, selectedRowClass } from "../pieces";
import {
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
  MobileCard,
  ResponsiveData,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { accountKindLabel } from "@/lib/ceo-config";
import { listHref } from "@/lib/list-url";
import { money } from "@/lib/money";

type AccountRow = {
  id: string;
  name: string;
  kind: string;
  bankName: string | null;
  clabe: string | null;
  fiscal: boolean;
  balance: number;
};

export function AccountsPanel({
  accounts,
  q,
  tipo,
  selectedId,
}: {
  accounts: AccountRow[];
  q: string;
  tipo: string;
  selectedId?: string;
}) {
  const kind = tipo === "BANCO" || tipo === "EFECTIVO" ? tipo : "";
  const visible = accounts.filter((account) => {
    if (kind && account.kind !== kind) return false;
    const label = account.kind === "BANCO" ? account.bankName || account.name : account.name;
    return matchesText(q, [label, account.name, account.bankName, account.clabe, accountKindLabel(account.kind)]);
  });
  const selected = accounts.find((account) => account.id === selectedId) ?? null;
  const hrefFor = (id?: string) => listHref("/configuracion/finanzas", {
    vista: "cuentas",
    q: q || undefined,
    tipo: kind || undefined,
    id,
  });

  return (
    <>
      <FilterBar action="/configuracion/finanzas">
        <input type="hidden" name="vista" value="cuentas" />
        <input name="q" defaultValue={q} placeholder="Nombre, banco o CLABE" className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} />
        <select name="tipo" defaultValue={kind} className={`${controlClass} sm:w-auto`}>
          <option value="">Todos los tipos</option>
          <option value="BANCO">Cuenta bancaria</option>
          <option value="EFECTIVO">Efectivo</option>
        </select>
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(kind ? [{ label: accountKindLabel(kind), clearHref: listHref("/configuracion/finanzas", { vista: "cuentas", q: q || undefined, id: selectedId }) }] : []),
          ...(q ? [{ label: `Búsqueda: ${q}`, clearHref: listHref("/configuracion/finanzas", { vista: "cuentas", tipo: kind || undefined, id: selectedId }) }] : []),
        ]}
      />
      {accounts.length === 0 ? (
        <Empty title="Sin cuentas" body="Crea la primera cuenta con el botón del encabezado. Las que ya existen siguen en esta lista." />
      ) : visible.length === 0 ? (
        <Empty title="Sin coincidencias" body="Ninguna cuenta coincide con el filtro." />
      ) : (
        <MasterDetail
          list={
            <ResponsiveData
              table={
                <Table stickyHeader>
                  <thead>
                    <tr>
                      <Th>Nombre</Th>
                      <Th>Tipo</Th>
                      <Th>Banco</Th>
                      <Th>CLABE</Th>
                      <Th>Fiscal</Th>
                      <Th>Saldo</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((account) => {
                      const selected = account.id === selectedId;
                      const label = account.kind === "BANCO" ? account.bankName || account.name : account.name;
                      return (
                        <tr key={account.id} className={selectedRowClass(selected)}>
                          <Td><SelectLink href={hrefFor(account.id)} selected={selected}>{label}</SelectLink></Td>
                          <Td>{accountKindLabel(account.kind)}</Td>
                          <Td>{account.bankName || "—"}</Td>
                          <Td>{account.clabe || "—"}</Td>
                          <Td><Badge tone={account.fiscal ? "ok" : "neutral"}>{account.fiscal ? "Sí" : "No"}</Badge></Td>
                          <Td>{money(account.balance)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              }
              cards={visible.map((account) => {
                const label = account.kind === "BANCO" ? account.bankName || account.name : account.name;
                return (
                  <MobileCard
                    key={account.id}
                    href={hrefFor(account.id)}
                    title={label}
                    meta={<Badge tone={account.fiscal ? "ok" : "neutral"}>{account.fiscal ? "Fiscal" : "No fiscal"}</Badge>}
                  >
                    <p>{accountKindLabel(account.kind)}</p>
                    <p className="mt-1">Saldo {money(account.balance)}</p>
                  </MobileCard>
                );
              })}
            />
          }
          editor={selected ? <AccountEditor account={selected} q={q} tipo={kind} /> : (
            <EditorPlaceholder title="Sin selección" body="Elige una cuenta de la lista para editarla. El saldo no se cambia aquí." />
          )}
        />
      )}
    </>
  );
}

function AccountEditor({ account, q, tipo }: { account: AccountRow; q: string; tipo: string }) {
  const label = account.kind === "BANCO" ? account.bankName || account.name : account.name;
  return (
    <div className="space-y-3">
      <FormPanel action={updateFinanceAccountAction} className="max-w-none">
        <HiddenFields fields={{ accountId: account.id, q, tipo }} />
        <FormSection
          title={label}
          description={`${accountKindLabel(account.kind)} · Saldo ${money(account.balance)}. El saldo no se edita aquí.`}
          columns={1}
        >
          <Field label="Fiscal">
            <select name="fiscal" defaultValue={account.fiscal ? "si" : "no"} className={controlClass}>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </Field>
          {account.kind === "BANCO" ? (
            <>
              <Field label="Nombre del banco">
                <input name="bankName" required defaultValue={account.bankName ?? ""} className={controlClass} />
              </Field>
              <Field label="CLABE">
                <input name="clabe" required defaultValue={account.clabe ?? ""} inputMode="numeric" autoComplete="off" className={controlClass} />
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
        <ConfirmSubmit message={financeAccountDeleteConfirm(label)} pendingLabel="Eliminando…">Eliminar</ConfirmSubmit>
      </form>
    </div>
  );
}
