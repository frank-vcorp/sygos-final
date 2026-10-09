import { redirect } from "next/navigation";
import { punchAction } from "./actions";
import { Badge, Button, EntityDetailHeader, EntityMetaItem } from "@/components/ui";
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
  const onSite = people.filter((person) => {
    const mark = person.attendance[0];
    return Boolean(mark?.entryAt && !mark.exitAt);
  }).length;

  return (
    <>
      <EntityDetailHeader
        title="Kiosco de asistencia"
        subtitle={session.activeCompanyName ?? ""}
        meta={
          <>
            <EntityMetaItem label="Fecha">{day}</EntityMetaItem>
            <EntityMetaItem label="Colaboradores">{people.length}</EntityMetaItem>
            <EntityMetaItem label="Dentro del taller">{onSite}</EntityMetaItem>
          </>
        }
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => {
          const mark = person.attendance[0];
          const open = Boolean(mark?.entryAt && !mark.exitAt);
          const statusLabel = mark?.status ?? "Sin marca";
          return (
            <li key={person.id} className="flex min-h-36 flex-col justify-between gap-4 rounded-xl border border-[var(--line)] bg-white p-4 shadow-[0_1px_2px_rgba(20,37,30,0.05)]">
              <div>
                <p className="text-lg font-semibold">{person.user.name}</p>
                <p className="mt-1">
                  <Badge tone={open ? "ok" : "neutral"}>{open ? "En turno" : statusLabel}</Badge>
                </p>
              </div>
              <form action={punchAction} className="w-full">
                <input type="hidden" name="collaboratorId" value={person.id} />
                <Button type="submit" name="kind" value={open ? "SALIDA" : "ENTRADA"} className="min-h-12 w-full text-base">
                  {open ? "Registrar salida" : "Registrar entrada"}
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
