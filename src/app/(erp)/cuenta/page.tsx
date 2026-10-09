import { changeOwnPasswordAction } from "@/app/auth-actions";
import { Button, controlClass, DetailAnchorButton, EntityDetailHeader, EntityMetaItem, Field, FormActions, FormPanel, FormSection } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/roles";
import { requireSession } from "@/lib/session";

export default async function CuentaPage() {
  const session = await requireSession();
  return (
    <>
      <EntityDetailHeader
        title={session.username}
        subtitle="Tu sesión en SYGOS"
        meta={
          <>
            <EntityMetaItem label="Rol">{ROLE_LABEL[session.role]}</EntityMetaItem>
            <EntityMetaItem label="Empresa activa">{session.activeCompanyName ?? "—"}</EntityMetaItem>
          </>
        }
        primaryAction={<DetailAnchorButton href="#cambiar-password">Cambiar contraseña</DetailAnchorButton>}
      />
      <FormPanel id="cambiar-password" action={changeOwnPasswordAction} className="scroll-mt-24 max-w-md">
        <FormSection title="Contraseña" description="La nueva contraseña debe tener al menos 10 caracteres." columns={1}>
          <Field label="Contraseña actual"><input name="current" type="password" className={controlClass} required /></Field>
          <Field label="Contraseña nueva" hint="Mínimo 10 caracteres."><input name="next" type="password" className={controlClass} required /></Field>
        </FormSection>
        <FormActions><Button type="submit">Actualizar contraseña</Button></FormActions>
      </FormPanel>
    </>
  );
}
