import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canSeeHomeSummary, homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/roles";

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
  if (!canSeeHomeSummary(session.role, session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
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
  const quickLinks = [
    can(session.role, "prospect.operate", session.activeCompanyCode) ? { href: "/prospectos/nuevo", title: "Nuevo prospecto", body: "Registrar una oportunidad comercial." } : null,
    can(session.role, "attention.create", session.activeCompanyCode) ? { href: "/servicios/diagnostico/nuevo", title: "Nueva atención", body: "Iniciar un diagnóstico desde el servicio." } : null,
    can(session.role, "quote.create", session.activeCompanyCode) ? { href: "/cotizaciones/nuevo", title: "Nueva cotización", body: "Preparar una propuesta para el cliente." } : null,
    can(session.role, "payment.register", session.activeCompanyCode) ? { href: "/pagos/nuevo", title: "Registrar pago", body: "Capturar un movimiento pendiente de validar." } : null,
  ].filter((item): item is { href: string; title: string; body: string } => Boolean(item));
  return (
    <>
      <PageHeader
        title={session.activeCompanyName ?? "Inicio"}
        subtitle="Los registros de esta vista pertenecen solo a la empresa activa."
      />
      {canSeeHomeSummary(session.role, session.activeCompanyCode) ? (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Resumen operativo</h2>
              <span className="text-xs text-[var(--muted)]">Datos de {session.activeCompanyName}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HomeCard index="01" href={can(session.role, "client.edit", session.activeCompanyCode) || can(session.role, "client.create", session.activeCompanyCode) ? "/clientes" : undefined} label="Clientes activos" value={clients} />
              <HomeCard index="02" href={can(session.role, "prospect.operate", session.activeCompanyCode) ? "/prospectos" : undefined} label="Prospectos abiertos" value={prospects} />
              <HomeCard index="03" href={can(session.role, "supplier.operate", session.activeCompanyCode) ? "/proveedores" : undefined} label="Proveedores activos" value={suppliers} />
              <HomeCard index="04" href={systron && can(session.role, "equi.view", session.activeCompanyCode) ? "/equipos" : !systron && can(session.role, "mot.view", session.activeCompanyCode) ? "/motores" : undefined} label={systron ? "EQUI sin entrada" : "MOT por ingresar"} value={custody} />
            </div>
          </section>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Accesos frecuentes</h2>
              {quickLinks.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {quickLinks.map((item) => <QuickLink key={item.href} {...item} />)}
                </div>
              ) : <Card className="p-5 text-sm text-[var(--muted)]">Tu perfil no tiene altas rápidas disponibles.</Card>}
            </section>
            <Card className="overflow-hidden">
              <div className="border-b border-[var(--line)] bg-[var(--accent)] px-5 py-4 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/70">Contexto activo</p>
                <p className="mt-1 text-xl font-semibold">{session.activeCompanyName}</p>
              </div>
              <div className="space-y-4 p-5 text-sm">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Perfil</p><p className="mt-1 font-medium">{ROLE_LABEL[session.role]}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Alcance</p><p className="mt-1 text-[var(--muted)]">Todas las cifras, búsquedas y documentos se limitan a la empresa activa.</p></div>
              </div>
            </Card>
          </div>
        </>
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

function HomeCard({ href, label, value, index }: { href?: string; label: string; value: number; index: string }) {
  const body = (
    <Card className="relative overflow-hidden p-5">
      <span className="absolute right-4 top-3 text-xs font-bold tracking-widest text-[#b9dce2]">{index}</span>
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0b1f3a]">{value}</p>
      <div className="mt-4 h-1 w-10 rounded-full bg-[var(--accent)]" />
    </Card>
  );
  return href ? <Link href={href} className="block rounded-lg outline-none transition-transform hover:-translate-y-0.5 hover:ring-2 hover:ring-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">{body}</Link> : body;
}

function QuickLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="group flex min-h-28 items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-white p-5 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
      <div><p className="font-semibold text-[#0b1f3a]">{title}</p><p className="mt-1 text-sm text-[var(--muted)]">{body}</p></div>
      <span className="text-2xl text-[var(--accent)] transition-transform group-hover:translate-x-1" aria-hidden>→</span>
    </Link>
  );
}
