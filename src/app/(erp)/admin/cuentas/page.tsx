import { redirect } from "next/navigation";
import { adjustAccountBalanceAction } from "./actions";
import { ConfirmSubmit } from "@/components/submit-button";
import {
  Badge,
  Button,
  controlClass,
  Empty,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  MoneyInput,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { accountKindLabel } from "@/lib/ceo-config";
import { prismaProd } from "@/lib/db";
import { money } from "@/lib/money";
import { requireCompany } from "@/lib/session";

export default async function AdminCuentasPage() {
  const session = await requireCompany();
  if (session.realRole !== "ADMINISTRADOR" || session.impersonating) redirect("/inicio");

  const accounts = await prismaProd.financeAccount.findMany({
    where: { companyId: session.activeCompanyId, active: true },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Cuentas y saldos"
        subtitle={`${session.activeCompanyName} · Mantenimiento en producción. Los ajustes quedan en movimientos con motivo obligatorio. No disponible en modo «ver como».`}
      />
      {accounts.length === 0 ? (
        <Empty title="Sin cuentas activas" body="Esta empresa no tiene cuentas financieras registradas." />
      ) : (
        <>
          <Table className="mb-6 max-w-4xl">
            <thead>
              <tr>
                <Th>Cuenta</Th>
                <Th>Tipo</Th>
                <Th>Saldo actual</Th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <Td>{account.name}</Td>
                  <Td>{accountKindLabel(account.kind)}</Td>
                  <Td>
                    {account.kind === "TARJETA" ? (
                      <span>
                        {money(account.balance)}{" "}
                        <Badge tone="neutral">deuda</Badge>
                      </span>
                    ) : (
                      money(account.balance)
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <FormPanel action={adjustAccountBalanceAction} className="max-w-xl">
            <FormSection
              title="Ajustar saldo"
              description="Indica el saldo objetivo de la cuenta (no el delta). Se registrará un ingreso o egreso por la diferencia."
              columns={1}
            >
              <Field label="Cuenta" hint="Solo cuentas activas de la empresa seleccionada.">
                <select name="accountId" required className={controlClass} defaultValue="">
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {accountKindLabel(account.kind)} · {money(account.balance)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nuevo saldo" hint="Saldo que debe quedar registrado después del ajuste.">
                <MoneyInput name="targetBalance" required />
              </Field>
              <Field label="Motivo" hint="Obligatorio. Aparece en el movimiento financiero.">
                <textarea name="motivo" required rows={3} className={controlClass} placeholder="Ej. Saldo inicial operativo, corrección post-seed…" />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirm" value="si" required className="mt-1" />
                <span>
                  Entiendo que este cambio se aplica en la base de producción, aunque haya un modo de pruebas activo para otros usuarios.
                </span>
              </label>
            </FormSection>
            <FormActions>
              <ConfirmSubmit message="El saldo se actualizará en producción y quedará un movimiento de auditoría. ¿Continuar?">
                Aplicar ajuste
              </ConfirmSubmit>
              <Button type="reset" tone="ghost">
                Limpiar
              </Button>
            </FormActions>
          </FormPanel>
        </>
      )}
    </>
  );
}
