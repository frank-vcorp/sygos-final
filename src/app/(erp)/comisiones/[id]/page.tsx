import { notFound, redirect } from "next/navigation";
import { commissionAdjustAction, commissionPayAction } from "../actions";
import { Badge, Button, DetailAnchorButton, EntityDetailHeader, EntityMetaItem, MobileCard } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = {
  PRELIMINAR: "Preliminar",
  PAGADA: "Pagada",
};

export default async function ComisionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.commissionRun.findFirst({ where: { id, companyId: session.activeCompanyId }, include: { lines: true } });
  if (!row) notFound();
  const ceo = can(session.role, "personnel.authorize");
  const open = row.status === "PRELIMINAR";
  const totalFinal = row.lines.reduce((sum, line) => sum + line.finalAmount, 0);

  let primaryAction: React.ReactNode = null;
  if (open && ceo) {
    primaryAction = (
      <>
        <DetailAnchorButton href="#lineas-comision">Revisar líneas</DetailAnchorButton>
        <form action={commissionPayAction} className="inline">
          <input type="hidden" name="runId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <Button type="submit">Validar y pagar</Button>
        </form>
      </>
    );
  }

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/comisiones", label: "Comisiones" }}
        title={row.month}
        subtitle="El intervalo alcanzado aplica a toda la facturación de ese tipo."
        status={<Badge tone={open ? "warn" : "neutral"}>{STATUS_LABEL[row.status] ?? row.status}</Badge>}
        meta={
          <>
            <EntityMetaItem label="Líneas">{row.lines.length}</EntityMetaItem>
            <EntityMetaItem label="Total a pagar">{money(totalFinal)}</EntityMetaItem>
          </>
        }
        primaryAction={primaryAction}
      />
      <ul id="lineas-comision" className="scroll-mt-24 grid gap-3">
        {row.lines.map((line) => (
          <li key={line.id}>
            <MobileCard
              title={line.label}
              meta={money(line.finalAmount)}
              footer={
                open && ceo ? (
                  <form action={commissionAdjustAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="runId" value={row.id} />
                    <input type="hidden" name="lineId" value={line.id} />
                    <input name="adjustment" type="number" step="0.01" defaultValue={line.adjustment} className="w-28 rounded-md border border-[var(--line)] px-2 py-2" />
                    <Button type="submit" tone="ghost">Ajustar</Button>
                  </form>
                ) : undefined
              }
            >
              <p>Fuente {money(line.sourceAmount)} · original {money(line.original)} · ajuste {money(line.adjustment)}</p>
              <p>{line.parameters}</p>
            </MobileCard>
          </li>
        ))}
      </ul>
    </>
  );
}
