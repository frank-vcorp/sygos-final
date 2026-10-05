import { cancelMovementAction, createAttentionAction, movementAction } from "@/app/(erp)/equipos/actions";
import { Button, controlClass, Field } from "@/components/ui";
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
}: {
  equipmentId: string;
  kind: "EQUI" | "MOT";
  version: number;
  priorities: PriorityRow[];
  repairs: Array<{ id: string; folio: string }>;
}) {
  return (
    <form action={createAttentionAction} className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
      <h2 className="font-medium">Nueva atención</h2>
      <p className="text-sm text-[var(--muted)]">Es un episodio de servicio. No crea otro equipo ni otro folio.</p>
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
      <Button type="submit">Crear atención</Button>
    </form>
  );
}

export function MovementForm({
  equipmentId,
  kind,
  custody,
  version,
  suppliers,
}: {
  equipmentId: string;
  kind: "EQUI" | "MOT";
  custody: Custody;
  version: number;
  suppliers: Array<{ id: string; name: string }>;
}) {
  const movements = allowedMovements(kind, custody);
  if (movements.length === 0) return null;
  return (
    <form action={movementAction} className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
      <h2 className="font-medium">Registrar movimiento</h2>
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="version" value={version} />
      <Field label="Movimiento">
        <select name="movement" required className={controlClass}>
          {movements.map((movement) => (
            <option key={movement} value={movement}>{MOVEMENT_LABEL[movement]}</option>
          ))}
        </select>
      </Field>
      <Field label="Motivo">
        <input name="reason" required className={controlClass} placeholder="Diagnóstico, reparación, venta, retorno…" />
      </Field>
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
      {movements.includes("SALIDA_PROVEEDOR" as MovementKind) ? (
        <Field label="Proveedor">
          <select name="supplierId" className={controlClass} defaultValue="">
            <option value="">Sin proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Observaciones"><textarea name="notes" rows={2} className={controlClass} /></Field>
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
