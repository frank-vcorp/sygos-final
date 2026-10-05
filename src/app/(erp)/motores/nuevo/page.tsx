import { redirect } from "next/navigation";
import { createMotAction } from "@/app/(erp)/equipos/actions";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, ATTENTION_TYPES, prioritySummary } from "@/lib/priorities";
import { requireCompany } from "@/lib/session";

export default async function NuevoMotPage() {
  const session = await requireCompany();
  if (!can(session.role, "mot.create", session.activeCompanyCode)) redirect("/motores");
  const [clients, priorities] = await Promise.all([
    prisma.client.findMany({
      where: {
        companyId: session.activeCompanyId,
        active: true,
        isSystem: false,
        ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}),
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.priority.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: [{ attentionType: "asc" }, { sortOrder: "asc" }] }),
  ]);
  return (
    <>
      <PageHeader
        title="Nuevo MOT"
        subtitle={session.activeCompanyCode === "SYSTRON"
          ? "La identidad es global. El trabajo físico queda pendiente de ingreso en Servomotores y no entra al almacén SYSTRON."
          : "Cliente directo de Servomotores. Después se confirma el ingreso físico."}
      />
      <form action={createMotAction} className="grid max-w-xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label={session.activeCompanyCode === "SYSTRON" ? "Cliente final" : "Cliente"}>
          <select name="clientId" required className={controlClass}>
            <option value="">Selecciona</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <Field label="Marca"><input name="brand" className={controlClass} /></Field>
        <Field label="Modelo o identificación"><input name="model" required className={controlClass} /></Field>
        <Field label="Descripción"><textarea name="description" rows={2} className={controlClass} /></Field>
        <Field label="Serie"><input name="serial" className={controlClass} /></Field>
        <Field label="Tipo de atención">
          <select name="attentionType" required className={controlClass}>
            <option value="">Selecciona</option>
            {ATTENTION_TYPES.map((type) => <option key={type} value={type}>{ATTENTION_LABEL[type]}</option>)}
          </select>
        </Field>
        <Field label="Prioridad">
          <select name="priorityId" required className={controlClass}>
            <option value="">Selecciona</option>
            {ATTENTION_TYPES.map((type) => (
              <optgroup key={type} label={ATTENTION_LABEL[type]}>
                {priorities.filter((row) => row.attentionType === type).map((row) => (
                  <option key={row.id} value={row.id}>{prioritySummary(row)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Falla reportada"><textarea name="reportedFault" required rows={3} className={controlClass} /></Field>
        <Field label="Antecedente" hint="Obligatorio en Diagnóstico de Garantía."><input name="antecedent" className={controlClass} /></Field>
        <Field label="Instrucciones de entrega"><textarea name="deliveryInstructions" rows={2} className={controlClass} /></Field>
        <Button type="submit">Crear folio MOT</Button>
      </form>
    </>
  );
}
