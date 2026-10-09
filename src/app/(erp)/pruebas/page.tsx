import { redirect } from "next/navigation";
import { finishSandboxAction, startSandboxAction } from "./actions";
import { Badge, Button, Card, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
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
      <PageHeader
        title="Modo de pruebas"
        subtitle="Un solo escenario. Al activarlo se copia el estado real. Al finalizar, esa copia se borra y no pasa a producción."
        action={meta.active ? <Badge tone="warn">Prueba activa</Badge> : <Badge tone="neutral">Inactivo</Badge>}
      />
      <Card className="mb-4 max-w-3xl p-4 text-sm">
        <h2 className="font-medium">Cómo recorrer el sistema con varios perfiles</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-[var(--muted)]">
          <li>Quien esté marcado, por usuario o por rol, lee y escribe la misma copia. Así Ventas, Técnico, Almacén, nómina y los demás se ven entre sí.</li>
          <li>Quien no esté marcado sigue en la operación real y no ve lo de la prueba.</li>
          <li>Para un recorrido de punta a punta marca cada perfil que va a intervenir, no solo uno.</li>
          <li>Si marcas un rol completo, cualquier persona real con ese rol que entre durante la prueba también cae en la copia.</li>
          <li>Facturapi no timbra: el documento queda como SIMULADA. El correo no sale y WhatsApp no se vincula.</li>
        </ul>
      </Card>
      {meta.active ? (
        <FormPanel action={finishSandboxAction} className="max-w-xl border-[#efd0d0]">
          <FormSection title="Finalizar prueba" description="Los cambios temporales se descartan y no se pueden recuperar." columns={1}>
            <p className="text-sm">La operación real sigue como está, con lo que haya pasado mientras tanto en producción.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirm" value="si" required />
              Entiendo que se descarta el escenario.
            </label>
          </FormSection>
          <FormActions><Button type="submit" tone="danger">Finalizar prueba</Button></FormActions>
        </FormPanel>
      ) : (
        <FormPanel action={startSandboxAction} className="max-w-xl">
          <FormSection title="Roles completos" description="Todos los usuarios con ese rol entran a la copia." columns={1}>
            <div className="grid gap-1">
              {ROLES.filter((role) => role !== "ADMINISTRADOR").map((role) => (
                <label key={role} className="flex gap-2 text-sm">
                  <input type="checkbox" name="role" value={role} />
                  {ROLE_LABEL[role]}
                </label>
              ))}
            </div>
          </FormSection>
          <FormSection title="Usuarios específicos" description="Marca solo las cuentas del recorrido si el personal real sigue operando." columns={1}>
            <div className="grid max-h-64 gap-1 overflow-auto">
              {users.filter((user) => isRole(user.role)).map((user) => (
                <label key={user.id} className="flex gap-2 text-sm">
                  <input type="checkbox" name="userId" value={user.id} />
                  {user.name}{user.company ? ` · ${user.company.name}` : ""}
                </label>
              ))}
            </div>
          </FormSection>
          <FormActions><Button type="submit">Activar prueba</Button></FormActions>
        </FormPanel>
      )}
    </>
  );
}
