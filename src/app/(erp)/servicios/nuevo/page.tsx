import { redirect } from "next/navigation";
import { ActionLink, Card, PageHeader, RecordLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import { SERVICIO_TIPO_OPTIONS } from "@/lib/servicios-catalog";
import { requireCompany } from "@/lib/session";

export default async function NuevoServicioPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "attention.create", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { clientId: requestedClientId } = await searchParams;
  const selectedClient = requestedClientId
    ? await prisma.client.findFirst({
        where: {
          id: requestedClientId,
          companyId: session.activeCompanyId,
          active: true,
          isSystem: false,
          ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}),
        },
        select: { id: true, name: true },
      })
    : null;
  const clientQuery = selectedClient ? `?clientId=${encodeURIComponent(selectedClient.id)}` : "";
  return (
    <>
      <PageHeader
        back={{ href: "/servicios/activos", label: "Servicios" }}
        title="Alta de servicios"
        subtitle={selectedClient
          ? `Cliente seleccionado: ${selectedClient.name}. Elige el tipo de servicio para continuar.`
          : "Elige el tipo de servicio. El formulario captura cliente, equipo y falla reportada."}
      />
      {selectedClient ? (
        <Card className="mb-4 border-[#cfe0d6] bg-[var(--accent-soft)] p-4">
          <p className="text-sm font-semibold text-[var(--ok)]">Cliente listo para el servicio</p>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {selectedClient.name} quedará preseleccionado en el siguiente formulario.
          </p>
        </Card>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-3">
        {SERVICIO_TIPO_OPTIONS.map((opt) => (
          <li key={opt.param}>
            <Card className="flex h-full flex-col justify-between p-4 transition hover:border-[var(--accent)] hover:shadow-sm">
              <div>
                <RecordLink href={`/servicios/${opt.param}/nuevo${clientQuery}`} className="text-base">{opt.label}</RecordLink>
                <p className="mt-2 text-sm text-[var(--muted)]">Servicio con cliente y equipo</p>
              </div>
              <ActionLink href={`/servicios/${opt.param}/nuevo${clientQuery}`} tone="ghost" className="mt-4 w-full">Continuar</ActionLink>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
