import { notFound } from "next/navigation";
import { CompanyLogo } from "@/components/brand-logo";
import { PrintButton } from "@/components/print-button";
import { ClientNameLink } from "@/components/client-entity-links";
import { TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { serviceClientForCompany } from "@/lib/intercompany-client";
import { formatWhen } from "@/lib/form";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { requireCompany } from "@/lib/session";

export default async function DxSinReparacionDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const session = await requireCompany();
  const { id } = await params;
  const query = await searchParams;
  const embedded = query.embed === "1";
  const row = await prisma.technicalCase.findFirst({
    where: { id, serviceCompanyId: session.activeCompanyId, kind: "DIAGNOSTICO" },
    include: {
      attention: { include: { adminClient: true } },
      equipment: { include: { client: true } },
      serviceCompany: true,
    },
  });
  if (!row || !row.noRepairAt || row.status !== "VALIDADO" || row.attention.attentionType !== "DIAGNOSTICO") {
    notFound();
  }
  const canPrint =
    can(session.role, "quote.follow", session.activeCompanyCode)
    || can(session.role, "custody.confirm", session.activeCompanyCode);
  if (!canPrint) notFound();

  const [seller, validator] = await Promise.all([
    row.attention.sellerUserId
      ? prisma.user.findUnique({ where: { id: row.attention.sellerUserId }, select: { name: true } })
      : null,
    row.validatedByUserId
      ? prisma.user.findUnique({ where: { id: row.validatedByUserId }, select: { name: true } })
      : null,
  ]);
  const backHref = row.equipment.kind === "MOT" ? `/motores/${row.equipmentId}` : `/equipos/${row.equipmentId}`;
  const shownClient = serviceClientForCompany(session.activeCompanyId, row.attention, row.equipment.client);
  const validatedOn = row.validatedAt ?? row.noRepairAt;
  const issued = validatedOn.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" });

  return (
    <div className={`mx-auto max-w-4xl space-y-4 print:max-w-none${embedded ? " p-0" : ""}`}>
      {embedded ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <TextLink href={backHref}>Volver al equipo</TextLink>
          <PrintButton />
        </div>
      )}
      <article className="quote-document overflow-hidden rounded-lg border border-[var(--line)] bg-white text-sm print:rounded-none print:border-0">
        <header className="border-b-4 border-[var(--accent)] px-6 py-6 sm:px-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <CompanyLogo code={row.serviceCompany.code} />
              <p className="mt-3 font-semibold">{row.serviceCompany.legalName || row.serviceCompany.name}</p>
            </div>
            <div className="min-w-52 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Retiro sin reparación</p>
              <p className="mt-1 text-3xl font-semibold text-[var(--accent)]">{row.folio}</p>
              <p className="mt-1">{issued}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{formatWhen(validatedOn)}</p>
            </div>
          </div>
        </header>

        <div className="px-6 py-6 sm:px-10">
          <section className="rounded-lg border border-[var(--line)] bg-[#f7f8f9] p-4">
            <p className="text-base font-semibold text-[var(--accent)]">Diagnóstico sin reparación — retiro autorizado</p>
            {row.noRepairReason ? (
              <p className="mt-2 whitespace-pre-wrap text-[var(--muted)]">Motivo técnico: {row.noRepairReason}</p>
            ) : null}
          </section>

          <section className="mt-6 grid gap-4 rounded-lg bg-[#f7f8f9] p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Cliente</p>
              <p className="mt-1 text-base font-semibold">
                <ClientNameLink
                  clientId={shownClient.id}
                  name={shownClient.name}
                  isSystem={shownClient.isSystem}
                />
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Equipo</p>
              <p className="mt-1 font-medium">{row.equipment.folio}</p>
              <p className="text-sm text-[var(--muted)]">
                {[row.equipment.typeName, row.equipment.brandName, row.equipment.model].filter(Boolean).join(" · ")}
              </p>
            </div>
          </section>

          <section className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Servicio</p>
              <p className="mt-1 font-medium">{ATTENTION_LABEL[row.attention.attentionType as AttentionType] ?? row.attention.attentionType}</p>
              <p className="mt-1 text-[var(--muted)]">Prioridad: {row.attention.priorityName}</p>
              <p className="text-[var(--muted)]">Falla: {row.attention.reportedFault}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Comercial</p>
              <p className="mt-1">Vendedor: {seller?.name ?? "—"}</p>
              <p className="text-[var(--muted)]">Validó gerencia: {validator?.name ?? "—"}</p>
            </div>
          </section>

          <section className="mt-10 grid gap-10 border-t border-[var(--line)] pt-8 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Entrega almacén</p>
              <div className="mt-12 border-t border-[var(--line)] pt-2 text-sm text-[var(--muted)]">Nombre y firma</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Recibe equipo</p>
              <div className="mt-12 border-t border-[var(--line)] pt-2 text-sm text-[var(--muted)]">{seller?.name ?? "Cliente / vendedor"} · firma</div>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
