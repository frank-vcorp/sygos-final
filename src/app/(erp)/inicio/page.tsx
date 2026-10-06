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
  const own = session.role === "VENTAS" ? { ownerUserId: session.userId } : {};
  const [clients, prospects, suppliers, custody] = await Promise.all([
    prisma.client.count({ where: { companyId: session.activeCompanyId, active: true, ...own } }),
    prisma.prospect.count({ where: { companyId: session.activeCompanyId, status: { in: ["NUEVO", "EN_SEGUIMIENTO"] }, ...own } }),
    prisma.supplier.count({ where: { companyId: session.activeCompanyId, active: true, isSystem: false } }),
    systron
      ? prisma.equipment.count({ where: { kind: "EQUI", originCompanyId: session.activeCompanyId, custody: "SIN_CUSTODIA", ...(session.role === "VENTAS" ? { client: own } : {}) } })
      : prisma.equipment.count({ where: { kind: "MOT", custody: "PENDIENTE_INGRESO", OR: [{ originCompanyId: session.activeCompanyId }, { originCompany: { code: "SYSTRON" } }], ...(session.role === "VENTAS" ? { client: own } : {}) } }),
  ]);
  return (
    <>
      <PageHeader
        title={session.activeCompanyName ?? "Inicio"}
        subtitle="Los registros de esta vista pertenecen solo a la empresa activa."
      />
      {can(session.role, "nav.business") ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HomeCard href={can(session.role, "client.edit", session.activeCompanyCode) || can(session.role, "client.create", session.activeCompanyCode) ? "/clientes" : undefined} label="Clientes activos" value={clients} />
          <HomeCard href={can(session.role, "prospect.operate", session.activeCompanyCode) ? "/prospectos" : undefined} label="Prospectos abiertos" value={prospects} />
          <HomeCard href={can(session.role, "supplier.operate", session.activeCompanyCode) ? "/proveedores" : undefined} label="Proveedores activos" value={suppliers} />
          <HomeCard href={systron && can(session.role, "equi.view", session.activeCompanyCode) ? "/equipos" : !systron && can(session.role, "mot.view", session.activeCompanyCode) ? "/motores" : undefined} label={systron ? "EQUI sin entrada" : "MOT por ingresar"} value={custody} />
        </div>
      ) : (
        <Card className="p-4 text-sm">
          {session.role === "KIOSCO_ASISTENCIA" ? (
            <p>El kiosco solo marca entrada y salida. <Link href="/kiosco" className="font-medium text-[var(--accent)]">Abrir marcaje</Link></p>
          ) : (
            <p>El Ayudante General tiene usuario para Personal, Nómina y Asistencia. No tiene acceso operativo a módulos de negocio. Sus horas extra las registra el gerente.</p>
          )}
        </Card>
      )}
    </>
  );
}

function HomeCard({ href, label, value }: { href?: string; label: string; value: number }) {
  const body = (
    <Card className="p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Card>
  );
  return href ? <Link href={href} className="block rounded-lg hover:ring-2 hover:ring-[var(--accent)]">{body}</Link> : body;
}
