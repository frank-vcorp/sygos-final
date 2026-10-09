import { cancelMovementAction, createAttentionAction, movementAction } from "@/app/(erp)/equipos/actions";
import { MovementReasonFields } from "@/components/movement-reason-fields";
import { SupplierPicker } from "@/components/supplier-picker";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";
import { allowedMovements, MOVEMENT_LABEL, type Custody, type MovementKind } from "@/lib/custody";
import { ATTENTION_LABEL, ATTENTION_TYPES, prioritySummary } from "@/lib/priorities";

type PriorityRow = {
  id: string;
  attentionType: string;
  name: string;
  price: number | null;
  incrementPct: number | null;
  targetMinDays: number | null;
  targetMaxDays: number | null;
  slaMaxDays: number;
};

export function AttentionForm({
  equipmentId,
  kind,
  version,
  priorities,
  repairs,
  variant = "card",
}: {
  equipmentId: string;
  kind: "EQUI" | "MOT";
  version: number;
  priorities: PriorityRow[];
  repairs: Array<{ id: string; folio: string }>;
  variant?: "card" | "plain";
}) {
  const fields = (
    <>
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="version" value={version} />
      <Field label="Tipo de atención">
        <select name="attentionType" required className={controlClass}>
          <option value="">Selecciona</option>
          {ATTENTION_TYPES.map((type) => (
            <option key={type} value={type}>{ATTENTION_LABEL[type]}</option>
          ))}
        </select>
      </Field>
      <Field label="Prioridad" hint="Se congela al crear. Un cambio posterior del catálogo no altera esta atención.">
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
      <Field label="Reparación de origen" hint="Obligatoria en Diagnóstico de Garantía. Debe estar terminada, pagada y dentro de seis meses desde su salida.">
        <select name="originalCaseId" className={controlClass} defaultValue="">
          <option value="">Sin reparación previa</option>
          {repairs.map((repair) => <option key={repair.id} value={repair.id}>{repair.folio}</option>)}
        </select>
      </Field>
      <Field label="Antecedente" hint="Contexto del reclamo. En garantía no sustituye la reparación de origen."><input name="antecedent" className={controlClass} /></Field>
      {kind === "MOT" ? (
        <Field label="Instrucciones de entrega" hint="Solo lo necesario para una entrega directa. No incluye precio.">
          <textarea name="deliveryInstructions" rows={2} className={controlClass} />
        </Field>
      ) : null}
    </>
  );
  if (variant === "card") {
    return (
      <FormPanel action={createAttentionAction}>
        <FormSection title="Nueva atención" description="Es un episodio de servicio. No crea otro equipo ni otro folio." columns={1}>
          {fields}
        </FormSection>
        <FormActions><Button type="submit">Crear atención</Button></FormActions>
      </FormPanel>
    );
  }
  return (
    <form action={createAttentionAction} className="grid gap-3">
      {fields}
      <Button type="submit">Crear atención</Button>
    </form>
  );
}

export function MovementForm({
  equipmentId,
  equipmentFolio,
  kind,
  custody,
  version,
  suppliers,
  allowQuickSupplier = false,
  variant = "card",
  receiptPreset,
}: {
  equipmentId: string;
  equipmentFolio: string;
  kind: "EQUI" | "MOT";
  custody: Custody;
  version: number;
  suppliers: Array<{ id: string; name: string }>;
  allowQuickSupplier?: boolean;
  variant?: "card" | "plain";
  receiptPreset?: {
    movement: MovementKind;
    reason: string;
    serviceLabel: string;
    reportedFault: string;
    clientName: string;
  };
}) {
  const movements = allowedMovements(kind, custody);
  if (movements.length === 0) return null;
  if (receiptPreset) {
    const body = (
      <>
        <input type="hidden" name="equipmentId" value={equipmentId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="movement" value={receiptPreset.movement} />
        <input type="hidden" name="reason" value={receiptPreset.reason} />
        <p className="text-sm text-[var(--muted)]">
          El tipo de servicio ya lo definió ventas. Al confirmar, el equipo queda en resguardo y arranca el SLA.
        </p>
        <dl className="grid gap-2 rounded-md border border-[var(--line)] bg-[#f7f8f9] p-3 text-sm">
          <div><dt className="text-[var(--muted)]">Equipo</dt><dd className="font-medium">{equipmentFolio}</dd></div>
          <div><dt className="text-[var(--muted)]">Cliente</dt><dd>{receiptPreset.clientName}</dd></div>
          <div><dt className="text-[var(--muted)]">Servicio</dt><dd>{receiptPreset.serviceLabel}</dd></div>
          <div><dt className="text-[var(--muted)]">Falla reportada</dt><dd>{receiptPreset.reportedFault}</dd></div>
          <div><dt className="text-[var(--muted)]">Movimiento</dt><dd>{MOVEMENT_LABEL[receiptPreset.movement]}</dd></div>
        </dl>
      </>
    );
    if (variant === "card") {
      return (
        <FormPanel action={movementAction}>
          {body}
          <FormActions><Button type="submit">Confirmar {MOVEMENT_LABEL[receiptPreset.movement].toLowerCase()} física</Button></FormActions>
        </FormPanel>
      );
    }
    return (
      <form action={movementAction} className="grid gap-3">
        {body}
        <Button type="submit">Confirmar {MOVEMENT_LABEL[receiptPreset.movement].toLowerCase()} física</Button>
      </form>
    );
  }

  const isSimpleExit = movements.length === 1 && movements[0] === "RETORNO";

  const movementBody = (
    <>
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="version" value={version} />
      <MovementReasonFields movements={movements} />
      {!isSimpleExit ? (
        <>
          <Field label="Fecha y hora"><input name="occurredAt" type="datetime-local" className={controlClass} /></Field>
          <Field label="Persona que recibe" hint="No se convierte en cliente. Obligatoria en salida a prueba y en salida definitiva.">
            <input name="receiverName" className={controlClass} />
          </Field>
          <Field label="Modalidad de entrega">
            <select name="deliveryMode" className={controlClass} defaultValue="">
              <option value="">Sin definir</option>
              <option value="Recoge en sitio">Recoge en sitio</option>
              <option value="Entrega directa">Entrega directa</option>
              <option value="Paquetería">Paquetería</option>
            </select>
          </Field>
          <Field label="Contacto"><input name="contact" className={controlClass} /></Field>
          <Field label="Documento habilitante" hint="Factura o remisión cuando la salida es definitiva. El documento fiscal se liga en su fase.">
            <input name="enablingDocument" className={controlClass} />
          </Field>
        </>
      ) : null}
      {movements.includes("SALIDA_PROVEEDOR" as MovementKind) ? (
        <SupplierPicker
          suppliers={suppliers}
          allowQuickSupplier={allowQuickSupplier}
          allowEmpty
          emptyLabel="Sin proveedor"
          label="Proveedor"
          hint="Obligatorio al registrar salida a proveedor externo."
        />
      ) : null}
      <Field label="Observaciones"><textarea name="notes" rows={2} className={controlClass} /></Field>
    </>
  );

  if (variant === "card") {
    return (
      <FormPanel action={movementAction}>
        <FormSection title="Registrar movimiento" columns={1}>{movementBody}</FormSection>
        <FormActions><Button type="submit">Confirmar movimiento</Button></FormActions>
      </FormPanel>
    );
  }
  return (
    <form action={movementAction} className="grid gap-3">
      {movementBody}
      <Button type="submit">Confirmar movimiento</Button>
    </form>
  );
}

export function CancelMovementForm({
  equipmentId,
  kind,
  movementId,
}: {
  equipmentId: string;
  kind: "EQUI" | "MOT";
  movementId: string;
}) {
  return (
    <form action={cancelMovementAction} className="mt-2 flex flex-wrap gap-2">
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="movementId" value={movementId} />
      <input name="cancelReason" required placeholder="Motivo de cancelación" className="rounded-md border border-[var(--line)] px-2 py-1 text-sm" />
      <Button type="submit" tone="ghost">Cancelar movimiento</Button>
    </form>
  );
}
