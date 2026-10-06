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
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => {
          const mark = person.attendance[0];
          const open = Boolean(mark?.entryAt && !mark.exitAt);
          return (
            <li key={person.id} className="flex min-h-36 flex-col justify-between gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
              <div><p className="text-lg font-semibold">{person.user.name}</p><p className="text-sm text-[var(--muted)]">{mark?.status ?? "Sin marca"}</p></div>
              <form action={punchAction} className="w-full">
                <input type="hidden" name="collaboratorId" value={person.id} />
                <button name="kind" value={open ? "SALIDA" : "ENTRADA"} className="min-h-12 w-full rounded-md bg-[var(--accent)] px-4 text-base font-semibold text-white">{open ? "Registrar salida" : "Registrar entrada"}</button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
