import { redirect } from "next/navigation";
import { updateFinanceAccountAction } from "../ceo-actions";
import { NewAccountForm } from "./account-form";
import { Badge, Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { accountKindLabel } from "@/lib/ceo-config";
import { money } from "@/lib/money";
import { requireCompany } from "@/lib/session";

export default async function CuentasConfigPage() {
  const session = await requireCompany();
  if (session.role !== "CEO") redirect("/inicio");
  const accounts = await prisma.financeAccount.findMany({
    where: { companyId: session.activeCompanyId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Cuentas"
        subtitle={`${session.activeCompanyName} · Las cuentas ya registradas siguen en esta misma lista.`}
      />
      <NewAccountForm />
      <section className="mt-8 max-w-5xl space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Cuentas existentes</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay cuentas en esta empresa.</p>
        ) : (
          <Table>
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
              {accounts.map((account) => (
                <tr key={account.id}>
                  <Td>{account.name}</Td>
                  <Td>{accountKindLabel(account.kind)}</Td>
                  <Td>{account.bankName || "—"}</Td>
                  <Td>{account.clabe || "—"}</Td>
                  <Td><Badge tone={account.fiscal ? "ok" : "neutral"}>{account.fiscal ? "Sí" : "No"}</Badge></Td>
                  <Td>{money(account.balance)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {accounts.map((account) => (
          <FormPanel key={account.id} action={updateFinanceAccountAction}>
            <input type="hidden" name="accountId" value={account.id} />
            <FormSection
              title={account.name}
              description={`${accountKindLabel(account.kind)} · Saldo ${money(account.balance)}. El saldo no se edita aquí.`}
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
                    <input name="clabe" required defaultValue={account.clabe ?? ""} inputMode="numeric" className={controlClass} />
                  </Field>
                </>
              ) : null}
            </FormSection>
            <FormActions>
              <Button type="submit" tone="ghost">Guardar cuenta</Button>
            </FormActions>
          </FormPanel>
        ))}
      </section>
    </>
  );
}
