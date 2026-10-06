import { redirect } from "next/navigation";
import { createProspectAction } from "../actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoProspectoPage() {
  const session = await requireCompany();
  if (!can(session.role, "prospect.operate", session.activeCompanyCode)) redirect("/inicio");
  return (
    <>
      <PageHeader back={{ href: "/prospectos", label: "Prospectos" }} title="Nuevo prospecto" subtitle="Nace en estado Nuevo. La conversión a cliente es manual." />
      <FormPanel action={createProspectAction}>
        <FormSection title="Oportunidad comercial" description="Registra lo mínimo para iniciar el seguimiento; después podrás completar su actividad." columns={2}>
          <Field label="Empresa o nombre"><input name="name" required className={controlClass} /></Field>
          <Field label="Fuente"><input name="source" className={controlClass} placeholder="Referencia, web, llamada…" /></Field>
          <div className="md:col-span-2"><Field label="Nota inicial"><textarea name="note" rows={4} className={controlClass} /></Field></div>
        </FormSection>
        <FormActions note="El prospecto se crea en estado Nuevo."><Button type="submit">Guardar y abrir detalle</Button></FormActions>
      </FormPanel>
    </>
  );
}
