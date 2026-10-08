import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyLogo } from "@/components/brand-logo";
import { PrintButton } from "@/components/print-button";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { MOVEMENT_LABEL, type MovementKind } from "@/lib/custody";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function EntradaDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const movement = await prisma.custodyMovement.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: {
      company: true,
      attention: true,
      equipment: { include: { client: true } },
    },
  });
  if (!movement || !movement.folio || (movement.kind !== "ENTRADA" && movement.kind !== "INGRESO")) notFound();
  const author = await prisma.user.findUnique({ where: { id: movement.authorUserId }, select: { name: true } });
  const seller = movement.attention?.sellerUserId
    ? await prisma.user.findUnique({ where: { id: movement.attention.sellerUserId }, select: { name: true } })
    : null;
  const backHref = movement.equipment.kind === "MOT" ? `/motores/${movement.equipmentId}` : `/equipos/${movement.equipmentId}`;
  const canPrint = can(session.role, "custody.confirm", session.activeCompanyCode) || can(session.role, "quote.follow", session.activeCompanyCode);
  if (!canPrint) notFound();

  const title = movement.kind === "INGRESO" ? "Ingreso físico" : "Entrada a almacén";
  const issued = movement.occurredAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" });

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm text-[var(--accent)]">Volver al equipo</Link>
        <PrintButton />
      </div>
      <article className="quote-document overflow-hidden rounded-lg border border-[var(--line)] bg-white text-sm print:rounded-none print:border-0">
        <header className="border-b-4 border-[var(--accent)] px-6 py-6 sm:px-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <CompanyLogo code={movement.company.code} />
              <p className="mt-3 font-semibold">{movement.company.legalName || movement.company.name}</p>
            </div>
            <div className="min-w-52 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{title}</p>
              <p className="mt-1 text-3xl font-semibold text-[var(--accent)]">{movement.folio}</p>
              <p className="mt-1">{issued}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{formatWhen(movement.occurredAt)}</p>
            </div>
          </div>
        </header>

        <div className="px-6 py-6 sm:px-10">
          <section className="grid gap-4 rounded-lg bg-[#f7f8f9] p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Cliente</p>
              <p className="mt-1 text-base font-semibold">{movement.equipment.client.isSystem ? "SYSTRON · intercompañía" : movement.equipment.client.name}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Equipo</p>
              <p className="mt-1 font-medium">{movement.equipment.folio}</p>
              <p className="text-sm text-[var(--muted)]">{[movement.equipment.typeName, movement.equipment.brandName, movement.equipment.model].filter(Boolean).join(" · ")}</p>
              {movement.equipment.serial ? <p className="text-sm text-[var(--muted)]">Serie: {movement.equipment.serial}</p> : null}
            </div>
          </section>

          <section className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Servicio</p>
              <p className="mt-1 font-medium">{movement.reason}</p>
              {movement.attention ? <p className="mt-1 text-[var(--muted)]">Falla: {movement.attention.reportedFault}</p> : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Movimiento</p>
              <p className="mt-1">{MOVEMENT_LABEL[movement.kind as MovementKind] ?? movement.kind}</p>
              <p className="mt-1 text-[var(--muted)]">Confirmó almacén: {author?.name ?? "—"}</p>
              {seller ? <p className="text-[var(--muted)]">Vendedor: {seller.name}</p> : null}
            </div>
          </section>

          {movement.notes ? (
            <section className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Observaciones</p>
              <p className="mt-1 whitespace-pre-wrap">{movement.notes}</p>
            </section>
          ) : null}

          <section className="mt-10 grid gap-10 border-t border-[var(--line)] pt-8 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Entrega (vendedor / quien trae el equipo)</p>
              <div className="mt-12 border-t border-[var(--line)] pt-2 text-sm text-[var(--muted)]">Nombre y firma</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Recibe almacén</p>
              <div className="mt-12 border-t border-[var(--line)] pt-2 text-sm text-[var(--muted)]">{author?.name ?? "—"} · firma</div>
            </div>
          </section>

          <p className="mt-8 text-xs text-[var(--muted)]">
            Documento generado al confirmar la {MOVEMENT_LABEL[movement.kind as MovementKind]?.toLowerCase() ?? "recepción"} física.
            Conserva una copia firmada para el expediente del equipo.
          </p>
        </div>
      </article>
    </div>
  );
}
