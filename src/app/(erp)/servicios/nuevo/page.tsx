import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { SERVICIO_TIPO_OPTIONS } from "@/lib/servicios-catalog";
import { requireCompany } from "@/lib/session";

export default async function NuevoServicioPage() {
  const session = await requireCompany();
  if (!can(session.role, "attention.create", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  return (
    <>
      <PageHeader
        back={{ href: "/servicios", label: "Servicios" }}
        title="Nuevo servicio"
        subtitle="Elige el tipo de atención. El formulario es el mismo que ya usabas; solo unificamos el acceso."
      />
      <ul className="grid gap-3 sm:grid-cols-3">
        {SERVICIO_TIPO_OPTIONS.map((opt) => (
          <li key={opt.param}>
            <Link
              href={`/servicios/${opt.param}/nuevo`}
              className="block rounded-lg border border-[var(--line)] bg-white p-4 transition hover:border-[var(--accent)] hover:shadow-sm"
            >
              <p className="font-medium text-[var(--accent)]">{opt.label}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Abrir alta con cliente y equipo</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
