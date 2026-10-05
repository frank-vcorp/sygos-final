import { redirect } from "next/navigation";
import { createActivityAction, saveGoalAction } from "./actions";
import { AgendaCalendar } from "@/components/agenda-calendar";
import { QuickPanel } from "@/components/quick-panel";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string; slot?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "agenda.use", session.activeCompanyCode)) redirect("/inicio");
  const { vista: rawVista, fecha, slot } = await searchParams;
  const vista = rawVista === "semana" || rawVista === "mes" ? rawVista : "dia";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "") ? fecha! : todayKey();
  const start = parseDay(anchor);
  const end = new Date(start);
  if (vista === "semana") end.setDate(end.getDate() + 7);
  else if (vista === "mes") end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + 1);
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
      <PageHeader title="Agenda comercial" subtitle="Elige un horario en el calendario para agendar. No genera recordatorios." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <a href={`/agenda?vista=${vista}&fecha=${shiftDay(anchor, vista, -1)}`} className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">Anterior</a>
        <a href={`/agenda?vista=${vista}&fecha=${todayKey()}`} className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">Hoy</a>
        <a href={`/agenda?vista=${vista}&fecha=${shiftDay(anchor, vista, 1)}`} className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">Siguiente</a>
        {[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]].map(([key, label]) => (
          <a key={key} href={`/agenda?vista=${key}&fecha=${anchor}`} className={`rounded-md px-3 py-2 text-sm ${vista === key ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white"}`}>{label}</a>
        ))}
        <span className="text-sm text-[var(--muted)]">{anchor}</span>
      </div>
      <AgendaCalendar
        view={vista}
        anchor={anchor}
        activities={activities.map((item) => ({ id: item.id, note: item.note, category: item.category?.name ?? "Actividad", at: item.scheduledAt.toISOString() }))}
      />
      <div className="mt-4" id="nueva">
        <QuickPanel label="Nueva actividad" defaultOpen={Boolean(slot)}>
          <form action={createActivityAction} className="grid gap-3">
            <input type="hidden" name="vista" value={vista} />
            <input type="hidden" name="fecha" value={anchor} />
            <Field label="Cuándo"><input name="scheduledAt" type="datetime-local" required defaultValue={slot ?? ""} className={controlClass} /></Field>
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

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function parseDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function shiftDay(value: string, vista: string, delta: number) {
  const date = parseDay(value);
  if (vista === "mes") date.setMonth(date.getMonth() + delta);
  else if (vista === "semana") date.setDate(date.getDate() + delta * 7);
  else date.setDate(date.getDate() + delta);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
