import { notFound, redirect } from "next/navigation";
import {
  addProspectActivityAction,
  convertProspectAction,
  discardProspectAction,
  reactivateProspectAction,
  updateProspectAction,
} from "../actions";
import { ConvertProspect } from "@/components/convert-prospect";
import { HistoryTimeline } from "@/components/history-timeline";
import { Badge, Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

const LABEL: Record<string, string> = {
  NUEVO: "Nuevo",
  EN_SEGUIMIENTO: "En seguimiento",
  CONVERTIDO: "Convertido",
  DESCARTADO: "Descartado",
};

export default async function ProspectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "prospect.operate", session.activeCompanyCode)) redirect("/inicio");
  const { id } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { activities: { orderBy: { createdAt: "desc" } }, client: true },
  });
  if (!prospect) notFound();
  await redirectIfSalesNotAssigned(session, prospect.ownerUserId, "/prospectos");
  const open = prospect.status === "NUEVO" || prospect.status === "EN_SEGUIMIENTO";
  const clients = open
    ? await prisma.client.findMany({
        where: { companyId: session.activeCompanyId, active: true, isSystem: false },
        orderBy: { name: "asc" },
        take: 200,
      })
    : [];
  const history = await historyFor("PROSPECTO", prospect.id);
  const authors = await prisma.user.findMany({
    where: { id: { in: prospect.activities.map((activity) => activity.authorUserId) } },
    select: { id: true, name: true },
  });
  const authorName = new Map(authors.map((author) => [author.id, author.name]));

  return (
    <>
      <PageHeader back={{ href: "/prospectos", label: "Prospectos" }} title={prospect.name} action={<Badge>{LABEL[prospect.status] ?? prospect.status}</Badge>} />
      {open ? (
        <form action={updateProspectAction} className="mb-4 grid max-w-xl gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
          <input type="hidden" name="id" value={prospect.id} />
          <input type="hidden" name="version" value={prospect.version} />
          <Field label="Empresa o nombre"><input name="name" defaultValue={prospect.name} className={controlClass} /></Field>
          <Field label="Fuente"><input name="source" defaultValue={prospect.source ?? ""} className={controlClass} /></Field>
          <Field label="Nota"><textarea name="note" defaultValue={prospect.note ?? ""} rows={3} className={controlClass} /></Field>
          <Button type="submit" tone="ghost">Guardar datos</Button>
        </form>
      ) : (
        <p className="mb-4 text-sm text-[var(--muted)]">{prospect.note}</p>
      )}

      {prospect.client ? (
        <p className="mb-4 text-sm">Cliente resultante: <a className="font-medium text-[var(--accent)]" href={`/clientes/${prospect.client.id}`}>{prospect.client.name}</a></p>
      ) : null}

      <section className="rounded-lg border border-[var(--line)] bg-white p-4">
        <h2 className="font-medium">Seguimiento</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">La fecha siguiente es informativa. No genera recordatorios.</p>
        <ul className="mt-3 space-y-2 text-sm">
          {prospect.activities.length === 0 ? <li className="text-[var(--muted)]">Sin actividades.</li> : prospect.activities.map((activity) => (
            <li key={activity.id}>
              <span className="text-[var(--muted)]">{formatWhen(activity.createdAt)} · {authorName.get(activity.authorUserId) ?? "Usuario"}</span>
              <p>{activity.note}</p>
              {activity.nextFollowUp ? <p className="text-[var(--muted)]">Siguiente: {formatWhen(activity.nextFollowUp)}</p> : null}
            </li>
          ))}
        </ul>
        {open ? (
          <form action={addProspectActivityAction} className="mt-4 grid gap-3">
            <input type="hidden" name="id" value={prospect.id} />
            <Field label="Nota"><textarea name="note" required rows={2} className={controlClass} /></Field>
            <Field label="Siguiente seguimiento"><input type="date" name="nextFollowUp" className={controlClass} /></Field>
            <Button type="submit">Registrar actividad</Button>
          </form>
        ) : null}
      </section>

      {open ? (
        <ConvertProspect
          prospectId={prospect.id}
          version={prospect.version}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          convertAction={convertProspectAction}
          discardAction={discardProspectAction}
        />
      ) : null}

      {prospect.status === "DESCARTADO" && (session.role === "CEO" || session.role === "ADMINISTRADOR") ? (
        <form action={reactivateProspectAction} className="mt-4 rounded-lg border border-[var(--line)] bg-white p-4">
          <input type="hidden" name="id" value={prospect.id} />
          <input type="hidden" name="version" value={prospect.version} />
          <Button type="submit" tone="ghost">Reactivar a En seguimiento</Button>
        </form>
      ) : null}

      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
