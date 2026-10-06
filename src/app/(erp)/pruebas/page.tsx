import { redirect } from "next/navigation";
import { finishSandboxAction, startSandboxAction } from "./actions";
import { PageHeader } from "@/components/ui";
import { prismaProd, readSandbox } from "@/lib/db";
import { ROLE_LABEL, ROLES, isRole } from "@/lib/roles";
import { requireSession } from "@/lib/session";

export default async function PruebasPage() {
  const session = await requireSession();
  if (session.realRole !== "ADMINISTRADOR" || session.impersonating) redirect("/inicio");
  const meta = readSandbox();
  const users = await prismaProd.user.findMany({ where: { active: true, role: { not: "ADMINISTRADOR" } }, include: { company: true }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Modo de pruebas" subtitle="Un solo escenario. Al activarlo se copia el estado real. Al finalizar, esa copia se borra y no pasa a producción." />
      {meta.active ? (
        <form action={finishSandboxAction} className="max-w-xl rounded-lg border border-[#efd0d0] bg-white p-4 text-sm">
          <p className="font-medium">Hay una prueba activa.</p>
          <p className="mt-2">Finalizar es definitivo. Los cambios temporales se descartan y no se pueden recuperar ni transferir. La operación real sigue como está, con lo que haya pasado mientras tanto.</p>
          <label className="mt-3 flex items-center gap-2"><input type="checkbox" name="confirm" value="si" required /> Entiendo que se descarta el escenario.</label>
          <button className="mt-3 rounded-md bg-[var(--danger)] px-3 py-2 text-sm font-medium text-white">Finalizar prueba</button>
        </form>
      ) : (
        <form action={startSandboxAction} className="max-w-xl space-y-3 rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
          <fieldset>
            <legend className="font-medium">Roles completos</legend>
            <div className="mt-2 grid gap-1">
              {ROLES.filter((role) => role !== "ADMINISTRADOR").map((role) => (
                <label key={role} className="flex gap-2"><input type="checkbox" name="role" value={role} /> {ROLE_LABEL[role]}</label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-medium">Usuarios</legend>
            <div className="mt-2 grid max-h-64 gap-1 overflow-auto">
              {users.filter((user) => isRole(user.role)).map((user) => (
                <label key={user.id} className="flex gap-2"><input type="checkbox" name="userId" value={user.id} /> {user.name}{user.company ? ` · ${user.company.name}` : ""}</label>
              ))}
            </div>
          </fieldset>
          <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Activar prueba</button>
        </form>
      )}
    </>
  );
}
