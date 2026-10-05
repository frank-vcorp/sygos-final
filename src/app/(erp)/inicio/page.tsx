import Link from "next/link";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";

export default async function InicioPage() {
  const session = await requireSession();
  if (!session.activeCompanyId) {
    return (
      <>
        <PageHeader title="Elige la empresa" subtitle="Antes de operar hay que dejar claro en qué empresa estás." />
        <Link href="/empresa" className="font-medium text-[var(--accent)]">Seleccionar empresa</Link>
      </>
    );
  }
  const systron = session.activeCompanyCode === "SYSTRON";
  const [clients, prospects, suppliers, custody] = await Promise.all([
    prisma.client.count({ where: { companyId: session.activeCompanyId, active: true } }),
    prisma.prospect.count({ where: { companyId: session.activeCompanyId, status: { in: ["NUEVO", "EN_SEGUIMIENTO"] } } }),
    prisma.supplier.count({ where: { companyId: session.activeCompanyId, active: true, isSystem: false } }),
    systron
      ? prisma.equipment.count({ where: { kind: "EQUI", originCompanyId: session.activeCompanyId, custody: "SIN_CUSTODIA" } })
      : prisma.equipment.count({ where: { kind: "MOT", custody: "PENDIENTE_INGRESO", OR: [{ originCompanyId: session.activeCompanyId }, { originCompany: { code: "SYSTRON" } }] } }),
  ]);
  return (
    <>
      <PageHeader
        title={session.activeCompanyName ?? "Inicio"}
        subtitle="Los registros de esta vista pertenecen solo a la empresa activa."
      />
      {can(session.role, "nav.business") ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="p-4"><p className="text-sm text-[var(--muted)]">Clientes activos</p><p className="text-2xl font-semibold">{clients}</p></Card>
          <Card className="p-4"><p className="text-sm text-[var(--muted)]">Prospectos abiertos</p><p className="text-2xl font-semibold">{prospects}</p></Card>
          <Card className="p-4"><p className="text-sm text-[var(--muted)]">Proveedores activos</p><p className="text-2xl font-semibold">{suppliers}</p></Card>
          <Card className="p-4"><p className="text-sm text-[var(--muted)]">{systron ? "EQUI sin entrada" : "MOT por ingresar"}</p><p className="text-2xl font-semibold">{custody}</p></Card>
        </div>
      ) : (
        <Card className="p-4 text-sm">
          {session.role === "KIOSCO_ASISTENCIA"
            ? "El marcaje de asistencia se habilita con el módulo de Personal. Esta cuenta no abre otros módulos."
            : "El Ayudante General tiene usuario para Personal, Nómina y Asistencia. No tiene acceso operativo a módulos de negocio."}
        </Card>
      )}
    </>
  );
}
