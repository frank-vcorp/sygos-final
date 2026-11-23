import { EntityDetailHeader, EntityMetaItem } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/roles";
import { requireSession } from "@/lib/session";

export default async function CuentaPage() {
  const session = await requireSession();
  return (
    <EntityDetailHeader
      title={session.username}
      subtitle="Tu sesión en SYGOS"
      meta={
        <>
          <EntityMetaItem label="Rol">{ROLE_LABEL[session.role]}</EntityMetaItem>
          <EntityMetaItem label="Empresa activa">{session.activeCompanyName ?? "—"}</EntityMetaItem>
        </>
      }
    />
  );
}