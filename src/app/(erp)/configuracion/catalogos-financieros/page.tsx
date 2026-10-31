import { redirect } from "next/navigation";
import { saveExpenseCategoryAction, saveExpenseSubcategoryAction, saveIncomeCategoryAction } from "../ceo-actions";
import { Badge, Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/session";

function ActiveSelect({ active }: { active?: boolean }) {
  return (
    <select name="active" defaultValue={active === false ? "no" : "si"} className={controlClass}>
      <option value="si">Activa</option>
      <option value="no">Inactiva</option>
    </select>
  );
}

export default async function CatalogosFinancierosPage() {
  const session = await requireCompany();
  if (session.role !== "CEO") redirect("/inicio");
  const [incomes, expenses] = await Promise.all([
    prisma.incomeCategory.findMany({ where: { companyId: session.activeCompanyId }, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({
      where: { companyId: session.activeCompanyId },
      include: { subcategories: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Catálogos financieros"
        subtitle={`${session.activeCompanyName} · Ingresos, egresos y subcategorías de egreso del catálogo que ya usa la operación.`}
      />

      <section className="max-w-5xl space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Ingresos</h2>
        <FormPanel action={saveIncomeCategoryAction}>
          <FormSection title="Nueva categoría de ingreso" columns={1}>
            <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
            <Field label="Estado"><ActiveSelect /></Field>
          </FormSection>
          <FormActions><Button type="submit">Agregar ingreso</Button></FormActions>
        </FormPanel>
        {incomes.map((row) => (
          <FormPanel key={row.id} action={saveIncomeCategoryAction}>
            <input type="hidden" name="id" value={row.id} />
            <FormSection title={row.name} description={row.active ? "Activa" : "Inactiva"}>
              <Field label="Nombre"><input name="name" required defaultValue={row.name} className={controlClass} /></Field>
              <Field label="Estado"><ActiveSelect active={row.active} /></Field>
            </FormSection>
            <FormActions><Button type="submit" tone="ghost">Guardar ingreso</Button></FormActions>
          </FormPanel>
        ))}
      </section>

      <section className="mt-10 max-w-5xl space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Egresos</h2>
        <FormPanel action={saveExpenseCategoryAction}>
          <FormSection title="Nueva categoría de egreso" columns={1}>
            <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
            <Field label="Estado"><ActiveSelect /></Field>
          </FormSection>
          <FormActions><Button type="submit">Agregar egreso</Button></FormActions>
        </FormPanel>
        {expenses.map((category) => (
          <div key={category.id} className="space-y-3">
            <FormPanel action={saveExpenseCategoryAction}>
              <input type="hidden" name="id" value={category.id} />
              <FormSection title={category.name} description={category.active ? "Categoría activa" : "Categoría inactiva"}>
                <Field label="Nombre"><input name="name" required defaultValue={category.name} className={controlClass} /></Field>
                <Field label="Estado"><ActiveSelect active={category.active} /></Field>
              </FormSection>
              <FormActions><Button type="submit" tone="ghost">Guardar egreso</Button></FormActions>
            </FormPanel>
            {category.subcategories.length > 0 ? (
              <ul className="ml-4 space-y-2 border-l border-slate-200 pl-4">
                {category.subcategories.map((sub) => (
                  <li key={sub.id}>
                    <FormPanel action={saveExpenseSubcategoryAction}>
                      <input type="hidden" name="id" value={sub.id} />
                      <FormSection
                        title={sub.name}
                        description="Subcategoría de egreso"
                      >
                        <Field label="Categoría">
                          <select name="categoryId" defaultValue={category.id} className={controlClass}>
                            {expenses.map((option) => (
                              <option key={option.id} value={option.id}>{option.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Nombre"><input name="name" required defaultValue={sub.name} className={controlClass} /></Field>
                        <Field label="Estado">
                          <div className="flex items-center gap-3">
                            <ActiveSelect active={sub.active} />
                            <Badge tone={sub.active ? "ok" : "neutral"}>{sub.active ? "Activa" : "Inactiva"}</Badge>
                          </div>
                        </Field>
                      </FormSection>
                      <FormActions><Button type="submit" tone="ghost">Guardar subcategoría</Button></FormActions>
                    </FormPanel>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ml-4 text-sm text-slate-500">Sin subcategorías.</p>
            )}
          </div>
        ))}
        {expenses.length > 0 ? (
          <FormPanel action={saveExpenseSubcategoryAction}>
            <FormSection title="Nueva subcategoría de egreso">
              <Field label="Categoría">
                <select name="categoryId" className={controlClass} required>
                  {expenses.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
              <Field label="Estado"><ActiveSelect /></Field>
            </FormSection>
            <FormActions><Button type="submit">Agregar subcategoría</Button></FormActions>
          </FormPanel>
        ) : null}
      </section>
    </>
  );
}
