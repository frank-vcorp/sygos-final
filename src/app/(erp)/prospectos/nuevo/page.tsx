import { redirect } from "next/navigation";
import { createProspectAction } from "../actions";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoProspectoPage() {
  const session = await requireCompany();
  if (!can(session.role, "prospect.operate", session.activeCompanyCode)) redirect("/inicio");
  return (
    <>
      <PageHeader back={{ href: "/prospectos", label: "Prospectos" }} title="Nuevo prospecto" subtitle="Nace en estado Nuevo. La conversión a cliente es manual." />
      <form action={createProspectAction} className="grid max-w-xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Empresa o nombre"><input name="name" required className={controlClass} /></Field>
        <Field label="Fuente"><input name="source" className={controlClass} /></Field>
        <Field label="Nota"><textarea name="note" rows={3} className={controlClass} /></Field>
        <Button type="submit">Guardar y abrir detalle</Button>
      </form>
    </>
  );
}
