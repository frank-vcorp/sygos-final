import { redirect } from "next/navigation";
import { createUserAction } from "../actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { companiesForRole, ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { requireCompany } from "@/lib/session";

function roleAvailableInCompany(role: Role, companyCode: string): boolean {
  const allowed = companiesForRole(role);
  if (allowed === "both") return true;
  return allowed.includes(companyCode as "SYSTRON" | "SERVOMOTORES");
}

export default async function NuevoUsuarioPage() {
  const session = await requireCompany();
  if (!can(session.role, "user.manage")) redirect("/inicio");
  const roles = ROLES.filter(
    (role) =>
      (role !== "ADMINISTRADOR" || can(session.role, "user.manageAdmins")) &&
      roleAvailableInCompany(role, session.activeCompanyCode),
  );
  return (
    <>
      <PageHeader
        back={{ href: "/usuarios", label: "Usuarios" }}
        title="Nuevo usuario"
        subtitle={`${session.activeCompanyName} · Se asigna automáticamente a la empresa activa del encabezado (o a ambas si el rol es transversal).`}
      />
      <FormPanel action={createUserAction}>
        <FormSection title="Identidad y acceso" description="Usuario, contraseña y rol fijo del catálogo del sistema.">
          <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
          <Field label="Usuario"><input name="username" required className={controlClass} autoComplete="off" /></Field>
          <Field label="Contraseña" hint="Mínimo 10 caracteres. No se vuelve a mostrar."><input name="password" type="password" required className={controlClass} /></Field>
          <Field label="Rol">
            <select name="role" className={controlClass} defaultValue={roles.includes("VENTAS") ? "VENTAS" : roles[0]}>
              {roles.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
            </select>
          </Field>
        </FormSection>
        <FormSection title="Límites opcionales" description="Solo aplican según el rol elegido.">
          <Field label="Límite de descuento (%)" hint="Solo aplica al rol Ventas."><input name="discountLimitPct" className={controlClass} /></Field>
          <Field label="Presupuesto mensual de compra" hint="Gerente Operativo. Si lo omites, queda en 5000."><MoneyInput name="monthlyPurchaseBudget" /></Field>
          <Field label="Máximo por compra directa" hint="Gerente Operativo. Si lo omites, queda en 2000."><MoneyInput name="purchaseLimit" /></Field>
        </FormSection>
        <FormActions><Button type="submit">Crear usuario</Button></FormActions>
      </FormPanel>
    </>
  );
}
