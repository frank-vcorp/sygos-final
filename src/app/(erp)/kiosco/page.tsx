import { redirect } from "next/navigation";
import { punchAction } from "./actions";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { mexicoToday } from "@/lib/personnel";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function KioscoPage() {
  const session = await requireCompany();
  if (!can(session.role, "kiosk.punch")) redirect("/inicio");
  const day = mexicoToday();
  const people = await prisma.collaborator.findMany({
    where: { companyId: session.activeCompanyId, status: "ACTIVO", exemptBenefits: false },
    include: { user: true, attendance: { where: { workDate: day } } },
    orderBy: { user: { name: "asc" } },
  });
  return (
    <>
      <PageHeader title="Kiosco" subtitle={`${day}. Solo entrada y salida de quien sí marca asistencia.`} />
      <ul className="space-y-3">
        {people.map((person) => {
          const mark = person.attendance[0];
          const open = Boolean(mark?.entryAt && !mark.exitAt);
          return (
            <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-3">
              <span>{person.user.name} · {mark?.status ?? "Sin marca"}</span>
              <form action={punchAction}>
                <input type="hidden" name="collaboratorId" value={person.id} />
                <button name="kind" value={open ? "SALIDA" : "ENTRADA"} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">{open ? "Salida" : "Entrada"}</button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
