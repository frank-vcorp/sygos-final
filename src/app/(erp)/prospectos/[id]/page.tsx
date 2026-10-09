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
import {
  ActionLink,
  Badge,
  Button,
  controlClass,
  DetailAnchorButton,
  EntityDetailHeader,
  EntityMetaItem,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  Card,
  MobileCard,
  RecordLink,
} from "@/components/ui";
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
  const nextFollowUp = prospect.activities.find((activity) => activity.nextFollowUp)?.nextFollowUp;

  let primaryAction: React.ReactNode = null;
  if (open) {
    primaryAction = (
      <>
        <DetailAnchorButton href="#seguimiento-prospecto">Registrar seguimiento</DetailAnchorButton>
        <ActionLink href="#conversion-prospecto" tone="ghost">Convertir o descartar</ActionLink>
      </>
    );
  }

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/prospectos", label: "Prospectos" }}
        title={prospect.name}
        subtitle={prospect.source ? `Fuente: ${prospect.source}` : "Prospecto comercial"}
        status={<Badge tone={open ? "warn" : "neutral"}>{LABEL[prospect.status] ?? prospect.status}</Badge>}
        meta={
          <>
            {prospect.note ? <EntityMetaItem label="Nota">{prospect.note}</EntityMetaItem> : null}
            {nextFollowUp ? <EntityMetaItem label="Siguiente seguimiento">{formatWhen(nextFollowUp)}</EntityMetaItem> : null}
            {prospect.client ? (
              <EntityMetaItem label="Cliente">
                <RecordLink href={`/clientes/${prospect.client.id}`}>{prospect.client.name}</RecordLink>
              </EntityMetaItem>
            ) : null}
          </>
        }
        primaryAction={primaryAction}
      />

      {open ? (
        <FormPanel id="datos-prospecto" action={updateProspectAction} className="mb-4 scroll-mt-24">
          <input type="hidden" name="id" value={prospect.id} />
          <input type="hidden" name="version" value={prospect.version} />
          <FormSection title="Datos del prospecto" description="Actualiza nombre, fuente y nota general.">
            <Field label="Empresa o nombre"><input name="name" defaultValue={prospect.name} className={controlClass} /></Field>
            <Field label="Fuente"><input name="source" defaultValue={prospect.source ?? ""} className={controlClass} /></Field>
            <div className="md:col-span-2">
              <Field label="Nota"><textarea name="note" defaultValue={prospect.note ?? ""} rows={3} className={controlClass} /></Field>
            </div>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Guardar datos</Button></FormActions>
        </FormPanel>
      ) : prospect.note ? (
        <p className="mb-4 text-sm text-[var(--muted)]">{prospect.note}</p>
      ) : null}

      <div id="seguimiento-prospecto" className="scroll-mt-24">
        <Card className="p-4">
          <h2 className="font-medium">Seguimiento</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">La fecha siguiente es informativa. No genera recordatorios.</p>
          <ul className="mt-3 grid gap-3 text-sm">
            {prospect.activities.length === 0 ? <li className="text-[var(--muted)]">Sin actividades.</li> : prospect.activities.map((activity) => (
              <li key={activity.id}>
                <MobileCard title={`${formatWhen(activity.createdAt)} · ${authorName.get(activity.authorUserId) ?? "Usuario"}`}>
                  <p>{activity.note}</p>
                  {activity.nextFollowUp ? <p>Siguiente: {formatWhen(activity.nextFollowUp)}</p> : null}
                </MobileCard>
              </li>
            ))}
          </ul>
        </Card>
        {open ? (
          <FormPanel action={addProspectActivityAction} className="mt-4 max-w-xl">
            <input type="hidden" name="id" value={prospect.id} />
            <FormSection title="Nueva actividad" columns={1}>
              <Field label="Nota"><textarea name="note" required rows={2} className={controlClass} /></Field>
              <Field label="Siguiente seguimiento"><input type="date" name="nextFollowUp" className={controlClass} /></Field>
            </FormSection>
            <FormActions><Button type="submit">Registrar actividad</Button></FormActions>
          </FormPanel>
        ) : null}
      </div>

      {open ? (
        <div id="conversion-prospecto" className="scroll-mt-24">
          <ConvertProspect
            prospectId={prospect.id}
            version={prospect.version}
            clients={clients.map((client) => ({ id: client.id, name: client.name }))}
            convertAction={convertProspectAction}
            discardAction={discardProspectAction}
          />
        </div>
      ) : null}

      {prospect.status === "DESCARTADO" && (session.role === "CEO" || session.role === "ADMINISTRADOR") ? (
        <FormPanel action={reactivateProspectAction} className="mt-4 max-w-xl">
          <input type="hidden" name="id" value={prospect.id} />
          <input type="hidden" name="version" value={prospect.version} />
          <FormSection title="Reactivar prospecto" description="Vuelve a estado En seguimiento." columns={1}>
            <p className="text-sm text-[var(--muted)]">El historial de actividades se conserva.</p>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Reactivar a En seguimiento</Button></FormActions>
        </FormPanel>
      ) : null}

      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
