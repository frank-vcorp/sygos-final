import type { Priority } from "@prisma/client";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput, PageHeader } from "@/components/ui";

type Mode = "diagnostico" | "reparacion";

export function PriorityEditor({
  title,
  subtitle,
  mode,
  priorities,
  action,
}: {
  title: string;
  subtitle: string;
  mode: Mode;
  priorities: Priority[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const diagnosis = mode === "diagnostico";
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="max-w-3xl space-y-4">
        <FormPanel action={action}>
          <FormSection title="Nueva prioridad" description="Independiente del otro grupo, aunque el nombre coincida.">
            <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
            <Field label="Estado">
              <select name="active" defaultValue="si" className={controlClass}>
                <option value="si">Activa</option>
                <option value="no">Inactiva</option>
              </select>
            </Field>
            {diagnosis ? (
              <Field label="Costo fijo"><MoneyInput name="price" defaultValue={0} /></Field>
            ) : (
              <Field label="Incremento porcentual">
                <input name="incrementPct" required defaultValue={0} inputMode="decimal" className={controlClass} />
              </Field>
            )}
            <Field label="SLA máximo en días">
              <input name="slaMaxDays" required type="number" min={1} step={1} className={controlClass} />
            </Field>
          </FormSection>
          <FormActions><Button type="submit">Agregar prioridad</Button></FormActions>
        </FormPanel>
        {priorities.map((priority) => (
          <FormPanel key={priority.id} action={action}>
            <input type="hidden" name="priorityId" value={priority.id} />
            <FormSection title={priority.name} description={priority.active ? "Activa" : "Inactiva"}>
              <Field label="Nombre"><input name="name" required defaultValue={priority.name} className={controlClass} /></Field>
              <Field label="Estado">
                <select name="active" defaultValue={priority.active ? "si" : "no"} className={controlClass}>
                  <option value="si">Activa</option>
                  <option value="no">Inactiva</option>
                </select>
              </Field>
              {diagnosis ? (
                <Field label="Costo fijo"><MoneyInput name="price" defaultValue={priority.price ?? 0} /></Field>
              ) : (
                <Field label="Incremento porcentual">
                  <input name="incrementPct" required defaultValue={priority.incrementPct ?? 0} inputMode="decimal" className={controlClass} />
                </Field>
              )}
              <Field label="SLA máximo en días">
                <input name="slaMaxDays" required type="number" min={1} step={1} defaultValue={priority.slaMaxDays} className={controlClass} />
              </Field>
            </FormSection>
            <FormActions><Button type="submit" tone="ghost">Guardar prioridad</Button></FormActions>
          </FormPanel>
        ))}
      </div>
    </>
  );
}
