import { notFound, redirect } from "next/navigation";
import { setUserActiveAction, updateUserAction } from "../actions";
import { Badge, Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
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
      <PageHeader title={user.name} subtitle={`${user.username} · ${ROLE_LABEL[user.role]} · ${user.company?.name ?? "Ambas empresas"}`} action={user.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="danger">Inactivo</Badge>} />
      <form action={updateUserAction} className="grid max-w-xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <input type="hidden" name="id" value={user.id} />
        <input type="hidden" name="version" value={user.version} />
        <Field label="Nombre"><input name="name" defaultValue={user.name} className={controlClass} /></Field>
        <Field label="Nueva contraseña" hint="Vacío conserva la actual. No se muestra la contraseña guardada."><input name="password" type="password" className={controlClass} /></Field>
        {user.role === "VENTAS" ? <Field label="Límite de descuento (%)"><input name="discountLimitPct" defaultValue={user.discountLimitPct ?? ""} className={controlClass} /></Field> : null}
        {isPurchaseManager(user.role) ? (
          <>
            <Field label="Presupuesto mensual de compra"><input name="monthlyPurchaseBudget" defaultValue={user.monthlyPurchaseBudget ?? 5000} className={controlClass} /></Field>
            <Field label="Máximo por compra directa"><input name="purchaseLimit" defaultValue={user.purchaseLimit ?? 2000} className={controlClass} /></Field>
          </>
        ) : null}
        <Button type="submit">Guardar</Button>
      </form>
      {user.id !== session.userId ? (
        <form action={setUserActiveAction} className="mt-4">
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="version" value={user.version} />
          <input type="hidden" name="active" value={user.active ? "no" : "si"} />
          <Button type="submit" tone={user.active ? "danger" : "ghost"}>{user.active ? "Desactivar" : "Reactivar"}</Button>
        </form>
      ) : null}
      <ul className="mt-6 space-y-2 text-sm">
        {history.map((item) => (
          <li key={item.id} className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
            <span className="text-[var(--muted)]">{formatWhen(item.createdAt)} · {item.author?.name ?? "Sistema"}</span>
            <p>{item.summary}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
