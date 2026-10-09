import { redirect } from "next/navigation";
import { createUserAction } from "../actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { companiesForRole, ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { requireSession } from "@/lib/session";

export default async function NuevoUsuarioPage() {
  const session = await requireSession();
  if (!can(session.role, "user.manage")) redirect("/inicio");
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  const roles = ROLES.filter((role) => role !== "ADMINISTRADOR" || can(session.role, "user.manageAdmins"));
  return (
    <>
      <PageHeader back={{ href: "/usuarios", label: "Usuarios" }} title="Nuevo usuario" subtitle="Un usuario operativo pertenece a una empresa. CEO, Coordinación y Administrador trabajan en ambas." />
      <FormPanel action={createUserAction}>
        <FormSection title="Identidad y acceso" description="Usuario, contraseña y rol fijo del catálogo del sistema.">
          <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
          <Field label="Usuario"><input name="username" required className={controlClass} autoComplete="off" /></Field>
          <Field label="Contraseña" hint="Mínimo 10 caracteres. No se vuelve a mostrar."><input name="password" type="password" required className={controlClass} /></Field>
          <Field label="Rol">
            <select name="role" className={controlClass} defaultValue="VENTAS">
              {roles.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}{companyHint(role)}</option>)}
            </select>
          </Field>
          <Field label="Empresa" hint="Déjala vacía solo para CEO, Coordinación y Administrador.">
            <select name="companyCode" className={controlClass} defaultValue="">
              <option value="">Ambas, si el rol lo permite</option>
              {companies.map((company) => <option key={company.id} value={company.code}>{company.name}</option>)}
            </select>
          </Field>
        </FormSection>
        <FormSection title="Límites opcionales" description="Solo aplican según el rol elegido.">
          <Field label="Límite de descuento (%)" hint="Solo aplica al rol Ventas."><input name="discountLimitPct" className={controlClass} /></Field>
          <Field label="Presupuesto mensual de compra" hint="Gerente Operativo. Si lo omites, queda en 5000."><input name="monthlyPurchaseBudget" className={controlClass} /></Field>
          <Field label="Máximo por compra directa" hint="Gerente Operativo. Si lo omites, queda en 2000."><input name="purchaseLimit" className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit">Crear usuario</Button></FormActions>
      </FormPanel>
    </>
  );
}

function companyHint(role: Role) {
  const companies = companiesForRole(role);
  if (companies === "both") return " · ambas empresas";
  if (role === "KIOSCO_ASISTENCIA") return " · una empresa";
  return ` · ${companies[0] === "SYSTRON" ? "SYSTRON" : "Servomotores"}`;
}
