import { notFound, redirect } from "next/navigation";
import { setUserActiveAction, updateUserAction } from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import {
  Badge,
  Button,
  controlClass,
  DetailAnchorButton,
  EntityDetailHeader,
  EntityMetaItem,
  Field,
  FormActions,
  FormPanel,
  FormSection,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { historyFor } from "@/lib/history";
import { can, canSeeUser } from "@/lib/permissions";
import { isPurchaseManager, isRole, ROLE_LABEL } from "@/lib/roles";
import { requireSession } from "@/lib/session";

export default async function UsuarioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!can(session.role, "user.manage")) redirect("/inicio");
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, include: { company: true } });
  if (!user || !isRole(user.role) || !canSeeUser(session.role, user.role)) notFound();
  const history = await historyFor("USUARIO", user.id);
  return (
    <>
      <EntityDetailHeader
        back={{ href: "/usuarios", label: "Usuarios" }}
        title={user.name}
        subtitle={ROLE_LABEL[user.role]}
        status={user.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="danger">Inactivo</Badge>}
        meta={
          <>
            <EntityMetaItem label="Usuario">{user.username}</EntityMetaItem>
            <EntityMetaItem label="Empresa">{user.company?.name ?? "Ambas empresas"}</EntityMetaItem>
            {user.role === "VENTAS" && user.discountLimitPct != null ? (
              <EntityMetaItem label="Límite de descuento">{user.discountLimitPct}%</EntityMetaItem>
            ) : null}
          </>
        }
        primaryAction={<DetailAnchorButton href="#datos-usuario">Editar usuario</DetailAnchorButton>}
      />
      <FormPanel id="datos-usuario" action={updateUserAction} className="scroll-mt-24">
        <input type="hidden" name="id" value={user.id} />
        <input type="hidden" name="version" value={user.version} />
        <FormSection title="Acceso y perfil" description="El rol es fijo; aquí ajustas nombre y contraseña.">
          <Field label="Nombre"><input name="name" defaultValue={user.name} className={controlClass} /></Field>
          <Field label="Nueva contraseña" hint="Vacío conserva la actual. No se muestra la contraseña guardada.">
            <input name="password" type="password" className={controlClass} />
          </Field>
          {user.role === "VENTAS" ? (
            <Field label="Límite de descuento (%)"><input name="discountLimitPct" defaultValue={user.discountLimitPct ?? ""} className={controlClass} /></Field>
          ) : null}
        </FormSection>
        {isPurchaseManager(user.role) ? (
          <FormSection title="Límites de compra" description="Aplican a compras directas del gerente operativo.">
            <Field label="Presupuesto mensual de compra"><input name="monthlyPurchaseBudget" defaultValue={user.monthlyPurchaseBudget ?? 5000} className={controlClass} /></Field>
            <Field label="Máximo por compra directa"><input name="purchaseLimit" defaultValue={user.purchaseLimit ?? 2000} className={controlClass} /></Field>
          </FormSection>
        ) : null}
        <FormActions><Button type="submit">Guardar</Button></FormActions>
      </FormPanel>
      {user.id !== session.userId ? (
        <form action={setUserActiveAction} className="mt-4">
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="version" value={user.version} />
          <input type="hidden" name="active" value={user.active ? "no" : "si"} />
          <Button type="submit" tone={user.active ? "danger" : "ghost"}>{user.active ? "Desactivar" : "Reactivar"}</Button>
        </form>
      ) : null}
      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
