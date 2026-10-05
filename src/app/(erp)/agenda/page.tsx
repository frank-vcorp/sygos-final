import { redirect } from "next/navigation";
import { createActivityAction, saveGoalAction } from "./actions";
import { AgendaCalendar } from "@/components/agenda-calendar";
import { QuickPanel } from "@/components/quick-panel";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "agenda.use", session.activeCompanyCode)) redirect("/inicio");
  const { vista } = await searchParams;
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (vista === "semana") end.setDate(end.getDate() + 7);
  else if (vista === "mes") end.setDate(end.getDate() + 31);
  else end.setDate(end.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const [activities, categories, sellers, goalType] = await Promise.all([
    prisma.agendaActivity.findMany({
      where: { companyId: session.activeCompanyId, scheduledAt: { gte: start, lt: end }, ...(session.role === "VENTAS" ? { authorUserId: session.userId } : {}) },
      include: { category: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.agendaCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
    can(session.role, "goals.manage", session.activeCompanyCode)
      ? prisma.user.findMany({ where: { role: "VENTAS", companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    prisma.goalType.findFirst({ where: { companyId: session.activeCompanyId, name: "Clientes nuevos", active: true } }),
  ]);
  return (
    <>
      <PageHeader title="Agenda comercial" subtitle="Día, semana o mes. No genera recordatorios." />
      <div className="mb-4 flex gap-2">
        {[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]].map(([key, label]) => (
          <a key={key} href={`/agenda?vista=${key}`} className={`rounded-md px-3 py-2 text-sm ${(vista ?? "dia") === key ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white"}`}>{label}</a>
        ))}
      </div>
      <AgendaCalendar
        view={vista === "semana" || vista === "mes" ? vista : "dia"}
        activities={activities.map((item) => ({ id: item.id, note: item.note, category: item.category?.name ?? "Actividad", at: item.scheduledAt.toISOString() }))}
      />
      <div className="mt-4">
        <QuickPanel label="Nueva actividad">
          <form action={createActivityAction} className="grid gap-3">
            <Field label="Cuándo"><input name="scheduledAt" type="datetime-local" required className={controlClass} /></Field>
            <Field label="Categoría">
              <select name="categoryId" className={controlClass} defaultValue="">
                <option value="">Sin categoría</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Nota"><textarea name="note" required rows={3} className={controlClass} /></Field>
            <Field label="Evidencia" hint="Si la categoría cuenta para metas, la evidencia permite contarla."><input name="evidence" className={controlClass} /></Field>
            <Button type="submit">Guardar</Button>
          </form>
        </QuickPanel>
      </div>
      {goalType && sellers.length > 0 ? (
        <form action={saveGoalAction} className="mt-4 grid max-w-xl gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Meta mensual · {goalType.name}</h2>
          <input type="hidden" name="goalTypeId" value={goalType.id} />
          <Field label="Vendedor">
            <select name="userId" className={controlClass}>{sellers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
          </Field>
          <Field label="Objetivo"><input name="target" type="number" min={1} required className={controlClass} /></Field>
          <Button type="submit" tone="ghost">Guardar objetivo del mes</Button>
        </form>
      ) : null}
    </>
  );
}
