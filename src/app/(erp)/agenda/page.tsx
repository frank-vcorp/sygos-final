import { redirect } from "next/navigation";
import { createActivityAction, saveGoalAction } from "./actions";
import { AgendaCalendar } from "@/components/agenda-calendar";
import { QuickPanel } from "@/components/quick-panel";
import {
  ActionLink,
  ActiveFilters,
  Button,
  controlClass,
  DetailAnchorButton,
  EntityDetailHeader,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  SegmentedNav,
} from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string; slot?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "agenda.use", session.activeCompanyCode)) redirect("/inicio");
  const { vista: rawVista, fecha, slot } = await searchParams;
  const vista = rawVista === "semana" || rawVista === "mes" ? rawVista : "dia";
  const today = todayKey();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "") ? fecha! : today;
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
  const vistaLabel = vista === "dia" ? "Día" : vista === "semana" ? "Semana" : "Mes";

  return (
    <>
      <EntityDetailHeader
        title="Agenda comercial"
        subtitle="Elige un horario en el calendario. No genera recordatorios automáticos."
        primaryAction={<DetailAnchorButton href="#nueva">Nueva actividad</DetailAnchorButton>}
        secondaryActions={goalType && sellers.length > 0 ? <ActionLink href="#metas" tone="ghost">Metas del mes</ActionLink> : null}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ActionLink href={`/agenda?vista=${vista}&fecha=${shiftDay(anchor, vista, -1)}`} tone="ghost">Anterior</ActionLink>
        <ActionLink href={`/agenda?vista=${vista}&fecha=${today}`} tone="ghost">Hoy</ActionLink>
        <ActionLink href={`/agenda?vista=${vista}&fecha=${shiftDay(anchor, vista, 1)}`} tone="ghost">Siguiente</ActionLink>
        <span className="text-sm text-[var(--muted)]">{anchor}</span>
      </div>
      <SegmentedNav
        items={[
          { href: listHref("/agenda", { vista: "dia", fecha: anchor }), label: "Día", active: vista === "dia" },
          { href: listHref("/agenda", { vista: "semana", fecha: anchor }), label: "Semana", active: vista === "semana" },
          { href: listHref("/agenda", { vista: "mes", fecha: anchor }), label: "Mes", active: vista === "mes" },
        ]}
      />
      <ActiveFilters
        items={[
          ...(vista !== "dia" ? [{ label: vistaLabel, clearHref: listHref("/agenda", { fecha: anchor !== today ? anchor : undefined }) }] : []),
          ...(anchor !== today ? [{ label: `Fecha ${anchor}`, clearHref: listHref("/agenda", { vista: vista !== "dia" ? vista : undefined }) }] : []),
        ]}
      />
      <AgendaCalendar
        view={vista}
        anchor={anchor}
        activities={activities.map((item) => ({ id: item.id, note: item.note, category: item.category?.name ?? "Actividad", at: item.scheduledAt.toISOString() }))}
      />
      <div className="mt-4 scroll-mt-24" id="nueva">
        <QuickPanel label="Nueva actividad" defaultOpen={Boolean(slot)}>
          <FormPanel action={createActivityAction}>
            <input type="hidden" name="vista" value={vista} />
            <input type="hidden" name="fecha" value={anchor} />
            <FormSection title="Actividad" description="Queda ligada a la fecha del calendario que estás viendo." columns={1}>
              <Field label="Cuándo"><input name="scheduledAt" type="datetime-local" required defaultValue={slot ?? ""} className={controlClass} /></Field>
              <Field label="Categoría">
                <select name="categoryId" className={controlClass} defaultValue="">
                  <option value="">Sin categoría</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </Field>
              <Field label="Nota"><textarea name="note" required rows={3} className={controlClass} /></Field>
              <Field label="Evidencia" hint="Si la categoría cuenta para metas, la evidencia permite contarla."><input name="evidence" className={controlClass} /></Field>
            </FormSection>
            <FormActions><Button type="submit">Guardar</Button></FormActions>
          </FormPanel>
        </QuickPanel>
      </div>
      {goalType && sellers.length > 0 ? (
        <FormPanel id="metas" action={saveGoalAction} className="mt-4 scroll-mt-24">
          <FormSection title={`Meta mensual · ${goalType.name}`} description="Objetivo por vendedor para el mes en curso." columns={1}>
            <input type="hidden" name="goalTypeId" value={goalType.id} />
            <Field label="Vendedor">
              <select name="userId" className={controlClass}>{sellers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
            </Field>
            <Field label="Objetivo"><input name="target" type="number" min={1} required className={controlClass} /></Field>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Guardar objetivo del mes</Button></FormActions>
        </FormPanel>
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
