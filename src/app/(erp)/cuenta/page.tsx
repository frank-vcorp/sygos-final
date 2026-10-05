import { changeOwnPasswordAction } from "@/app/auth-actions";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/roles";
import { requireSession } from "@/lib/session";

export default async function CuentaPage() {
  const session = await requireSession();
  return (
    <>
      <PageHeader title="Cuenta" subtitle={`${session.username} · ${ROLE_LABEL[session.role]}`} />
      <form action={changeOwnPasswordAction} className="max-w-md space-y-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Contraseña actual"><input name="current" type="password" className={controlClass} /></Field>
        <Field label="Contraseña nueva" hint="Mínimo 10 caracteres."><input name="next" type="password" className={controlClass} /></Field>
        <Button type="submit">Actualizar contraseña</Button>
      </form>
    </>
  );
}
