import { ServiciosSupervisorList } from "@/components/servicios-supervisor-list";
import { Card, TextLink } from "@/components/ui";
import type { Role } from "@/lib/roles";
import type { SupervisorServicioRow } from "@/lib/servicios-supervisor";

const LIST_CAP = 12;

function countLabel(count: number) {
  if (count === 0) return "Sin pendientes";
  if (count === 1) return "1 pendiente mostrado";
  return `${count} pendientes mostrados`;
}

function ServiciosTableBlock({
  rows,
  role,
  highlightRow,
}: {
  rows: SupervisorServicioRow[];
  role: Role;
  highlightRow?: (row: SupervisorServicioRow) => boolean;
}) {
  const shown = rows.slice(0, LIST_CAP);
  return (
    <div className="w-full px-4 pb-5 pt-2 sm:px-5">
      <ServiciosSupervisorList rows={shown} role={role} variant="activos" highlightRow={highlightRow} />
    </div>
  );
}

export function SalesPanelServiciosSection({
  title,
  empty,
  bandejaHref,
  rows,
  role,
  highlightRow,
}: {
  title: string;
  empty: string;
  bandejaHref?: string;
  rows: SupervisorServicioRow[];
  role: Role;
  highlightRow?: (row: SupervisorServicioRow) => boolean;
}) {
  const shown = rows.slice(0, LIST_CAP);
  return (
    <Card className="flex w-full flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{countLabel(shown.length)}</p>
        </div>
        {bandejaHref ? <TextLink href={bandejaHref}>Ver bandeja</TextLink> : null}
      </div>
      {shown.length === 0 ? (
        <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ServiciosTableBlock rows={rows} role={role} highlightRow={highlightRow} />
      )}
    </Card>
  );
}

export function SalesPanelServiciosGrouped({
  title,
  role,
  sections,
}: {
  title: string;
  role: Role;
  sections: Array<{ subtitle: string; empty: string; bandejaHref?: string; rows: SupervisorServicioRow[] }>;
}) {
  const total = sections.reduce((sum, section) => sum + Math.min(section.rows.length, LIST_CAP), 0);
  return (
    <Card className="flex w-full flex-col overflow-hidden p-0">
      <div className="border-b border-[var(--line)] bg-[#fbfdff] px-5 py-4">
        <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">{title}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{countLabel(total)}</p>
      </div>
      {sections.map((section, index) => {
        const shown = section.rows.slice(0, LIST_CAP);
        return (
          <section key={section.subtitle} className={index > 0 ? "border-t border-[var(--line)]" : ""}>
            <div className="flex flex-wrap items-start justify-between gap-3 bg-[#f8fbfd] px-5 py-3">
              <h3 className="text-sm font-semibold text-[var(--ink)]">{section.subtitle}</h3>
              {section.bandejaHref ? <TextLink href={section.bandejaHref}>Ver bandeja</TextLink> : null}
            </div>
            {shown.length === 0 ? (
              <p className="m-5 rounded-lg bg-[#f5f8fb] px-4 py-3 text-sm text-[var(--muted)]">{section.empty}</p>
            ) : (
              <ServiciosTableBlock rows={section.rows} role={role} />
            )}
          </section>
        );
      })}
    </Card>
  );
}
