import { notFound, redirect } from "next/navigation";
import { commissionAdjustAction, commissionPayAction } from "../actions";
import { Badge, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ComisionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.commissionRun.findFirst({ where: { id, companyId: session.activeCompanyId }, include: { lines: true } });
  if (!row) notFound();
  const ceo = can(session.role, "personnel.authorize");
  return (
    <>
      <PageHeader back={{ href: "/comisiones", label: "Comisiones" }} title={row.month} subtitle="El intervalo alcanzado aplica a toda la facturación de ese tipo." action={<Badge>{row.status}</Badge>} />
      <ul className="space-y-3">
        {row.lines.map((line) => (
          <li key={line.id} className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
            <p className="font-medium">{line.label}</p>
            <p className="mt-1">Fuente {money(line.sourceAmount)} · original {money(line.original)} · ajuste {money(line.adjustment)} · final {money(line.finalAmount)}</p>
            <p className="mt-1 text-[var(--muted)]">{line.parameters}</p>
            {row.status === "PRELIMINAR" && ceo ? (
              <form action={commissionAdjustAction} className="mt-2 flex gap-2">
                <input type="hidden" name="runId" value={row.id} />
                <input type="hidden" name="lineId" value={line.id} />
                <input name="adjustment" type="number" step="0.01" defaultValue={line.adjustment} className="w-28 rounded-md border border-[var(--line)] px-2 py-2" />
                <button className="rounded-md border border-[var(--line)] px-3 py-2">Ajustar</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {row.status === "PRELIMINAR" && ceo ? (
        <form action={commissionPayAction} className="mt-4">
          <input type="hidden" name="runId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Validar y pagar</button>
        </form>
      ) : null}
    </>
  );
}
