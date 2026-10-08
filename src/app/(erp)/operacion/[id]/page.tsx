import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prepareFromCaseAction } from "@/app/(erp)/cotizaciones/actions";
import {
  assignCaseAction,
  createPresolicitudAction,
  deletePresolicitudAction,
  externalDocumentAction,
  finishDiagnosisAction,
  finishRepairAction,
  issuePartAction,
  logAction,
  markPaidAction,
  overrideWarrantyAction,
  receivePartAction,
  reopenAction,
  requestPartAction,
  startCaseAction,
  updatePresolicitudAction,
  validateAction,
} from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { SupplierPicker } from "@/components/supplier-picker";
import { Badge, Button, controlClass, DetailGrid, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { diagnosisPresolicitudEditable, PRESOLICITUD_LABEL } from "@/lib/part-presolicitud";
import { CASE_STATUS_LABEL } from "@/lib/technical";
import { homePath } from "@/lib/home";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { serviciosBandejaHref, usesServiciosBandeja } from "@/lib/servicios-catalog";
import { HISTORIAL_CASE } from "@/lib/servicios-supervisor";
import { requireCompany } from "@/lib/session";

export default async function OperacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (session.role === "ALMACEN") redirect(homePath(session.role, session.activeCompanyCode));
  const { id } = await params;
  const row = await prisma.technicalCase.findUnique({
    where: { id },
    include: {
      attention: true,
      equipment: { include: { originCompany: true, client: true } },
      serviceCompany: true,
      assignee: true,
      logs: { orderBy: { createdAt: "asc" } },
      requests: { orderBy: { createdAt: "asc" } },
      presolicitudes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) notFound();
  const reflected = session.activeCompanyCode === "SYSTRON" && row.serviceCompany.code === "SERVOMOTORES" && row.equipment.originCompanyId === session.activeCompanyId;
  const owns = row.serviceCompanyId === session.activeCompanyId;
  if (!owns && !reflected) notFound();
  if (!can(session.role, row.equipment.kind === "EQUI" ? "equi.view" : "mot.view", session.activeCompanyCode) && !reflected) notFound();
  await redirectIfSalesNotAssigned(session, row.equipment.client.ownerUserId, "/operacion");
  const technicianOwned = row.assigneeUserId === session.userId || row.finishedByUserId === session.userId;
  if (session.role === "TECNICO" && !technicianOwned) notFound();
  const readOnly = !owns;
  const authors = await prisma.user.findMany({
    where: { id: { in: row.logs.map((item) => item.authorUserId) } },
    select: { id: true, name: true },
  });
  const names = new Map(authors.map((user) => [user.id, user.name]));
  const candidates = owns
    ? await prisma.user.findMany({
        where: {
          active: true,
          companyId: row.serviceCompanyId,
          role: row.serviceCompany.code === "SERVOMOTORES" ? "GERENTE_OPERATIVO_SERVOMOTORES" : { in: ["TECNICO", "SUPERVISOR_TECNICO"] },
        },
        orderBy: { name: "asc" },
      })
    : [];
  const suppliers = owns && row.serviceCompany.code === "SYSTRON"
    ? await prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true, isSystem: false }, orderBy: { name: "asc" } })
    : [];
  const history = await historyFor("OPERACION", row.id);
  const derived = await prisma.technicalCase.findFirst({ where: { spawnedFromId: row.id }, select: { id: true, folio: true } });
  const parent = row.spawnedFromId ? await prisma.technicalCase.findUnique({ where: { id: row.spawnedFromId }, select: { id: true, folio: true, kind: true } }) : null;
  const original = row.originalCaseId ? await prisma.technicalCase.findUnique({ where: { id: row.originalCaseId }, select: { id: true, folio: true } }) : null;
  const repairAfterDiagnosis = row.kind === "OS" && row.attention.attentionType === "DIAGNOSTICO";
  const equipmentHref = row.equipment.kind === "MOT" ? `/motores/${row.equipmentId}` : `/equipos/${row.equipmentId}`;
  const historial = (HISTORIAL_CASE as readonly string[]).includes(row.status);
  const closed = historial;
  const warranty = row.attention.attentionType === "DIAGNOSTICO_GARANTIA" && row.kind === "DIAGNOSTICO";
  const canManage = !readOnly && ["ADMINISTRADOR", "CEO", "SUPERVISOR_TECNICO", "GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES"].includes(session.role);
  const canWork = !readOnly && (session.role === "ADMINISTRADOR" || session.role === "CEO" || session.role === "SUPERVISOR_TECNICO" || (session.role === "GERENTE_OPERATIVO_SERVOMOTORES" && session.activeCompanyCode === "SERVOMOTORES") || (session.role === "TECNICO" && row.assigneeUserId === session.userId));
  const canEditPresolicitud =
    !readOnly &&
    session.role === "TECNICO" &&
    row.assigneeUserId === session.userId &&
    row.kind === "DIAGNOSTICO" &&
    diagnosisPresolicitudEditable(row.status);

  return (
    <>
      <PageHeader
        back={
          usesServiciosBandeja(session.role)
            ? {
                href: serviciosBandejaHref({ vista: historial ? "historial" : "activos" }),
                label: historial ? "Historial de servicio" : "Servicios activos",
              }
            : { href: "/operacion", label: "En proceso" }
        }
        title={row.folio}
        subtitle={`${row.kind === "OS" ? "Orden de servicio" : "Diagnóstico"} · ${row.serviceCompany.name}`}
        action={<Badge tone={row.quotePending ? "warn" : "neutral"}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>}
      />
      {readOnly ? <p className="mb-4 text-sm text-[var(--muted)]">Consulta de solo lectura. SYSTRON no modifica el estado ni la bitácora de Servomotores.</p> : null}
      <DetailGrid>
        <div className="space-y-4">
          <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
            <p>Equipo: <Link href={equipmentHref} className="text-[var(--accent)]">{row.equipment.folio}</Link> · {row.equipment.model}</p>
            <p className="mt-1">Atención: {repairAfterDiagnosis ? "Reparación" : ATTENTION_LABEL[row.attention.attentionType as AttentionType] ?? row.attention.attentionType}</p>
            {parent?.kind === "DIAGNOSTICO" ? <p className="mt-1">Diagnóstico de origen: <Link href={`/operacion/${parent.id}`} className="text-[var(--accent)]">{parent.folio}</Link></p> : null}
            <p className="mt-1">{repairAfterDiagnosis ? "Prioridad del diagnóstico" : "Prioridad congelada"}: {row.attention.priorityName}{row.attention.priorityPrice != null ? ` · $${row.attention.priorityPrice.toLocaleString("es-MX")}` : ""}{row.attention.priorityIncrementPct != null ? ` · incremento ${row.attention.priorityIncrementPct}%` : ""}</p>
            <p className="mt-1">Falla: {row.attention.reportedFault}</p>
            <p className="mt-1">SLA: {row.slaDueAt ? formatWhen(row.slaDueAt) : "Aún no inicia"}</p>
            <p className="mt-1">Responsable: {row.externalSupplierId ? "Servicio externo" : row.assignee?.name ?? "Sin asignar"}</p>
            {row.resultText ? <p className="mt-1">Resultado: {row.resultText}</p> : null}
            {row.returnReason ? <p className="mt-1">Devolución: {row.returnReason}</p> : null}
            {row.warrantyDecision ? <p className="mt-1">Decisión técnica de garantía: {row.warrantyDecision === "VALIDA" ? "Válida" : "No procedente"}</p> : null}
            {row.commercialDecision ? <p className="mt-1">Decisión comercial: {row.commercialDecision === "VALIDA" ? "Aceptada como garantía" : "A cotización"} · {row.commercialReason}</p> : null}
            {row.externalDocument ? <p className="mt-1">Documento externo: {row.externalDocument}</p> : null}
            {original ? <p className="mt-1">Reparación de origen: <Link href={`/operacion/${original.id}`} className="text-[var(--accent)]">{original.folio}</Link></p> : null}
            {derived ? <p className="mt-1">Reparación en garantía: <Link href={`/operacion/${derived.id}`} className="text-[var(--accent)]">{derived.folio}</Link></p> : null}
            {row.quotePending && can(session.role, "quote.price", session.activeCompanyCode) ? (
              <form action={prepareFromCaseAction} className="mt-3">
                <input type="hidden" name="caseId" value={row.id} />
                <Button type="submit">Preparar cotización</Button>
              </form>
            ) : row.quotePending ? <p className="mt-3 text-[var(--muted)]">Queda pendiente de cotizar.</p> : null}
            {row.paidAt ? <p className="mt-1">Marcada como pagada {formatWhen(row.paidAt)}.</p> : null}
          </section>
          {canWork && row.kind === "DIAGNOSTICO" && ["EN_DIAGNOSTICO", "DEVUELTO"].includes(row.status) ? (
            <form action={finishDiagnosisAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
              <h2 className="font-medium">Terminar diagnóstico</h2>
              <p className="text-sm text-[var(--muted)]">Resume el hallazgo técnico. La bitácora queda aparte para avances durante el trabajo.</p>
              <input type="hidden" name="caseId" value={row.id} />
              <input type="hidden" name="version" value={row.version} />
              <Field label="Resultado del diagnóstico">
                <textarea name="resultText" required rows={4} className={controlClass} placeholder="Hallazgo, pruebas y conclusión" />
              </Field>
              <Button type="submit">Terminar diagnóstico</Button>
            </form>
          ) : null}
          <section className="rounded-lg border border-[var(--line)] bg-white p-4">
            <h2 className="font-medium">Bitácora</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Las entradas no se editan ni se borran. Una corrección es una entrada nueva.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {row.logs.map((item) => (
                <li key={item.id} className="border-t border-[var(--line)] pt-2">
                  <span className="text-[var(--muted)]">{formatWhen(item.createdAt)} · {names.get(item.authorUserId) ?? "—"}</span>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
            {canWork && !closed ? (
              <form action={logAction} className="mt-3 grid gap-2">
                <input type="hidden" name="caseId" value={row.id} />
                <textarea name="body" required rows={3} className={controlClass} placeholder="Avance, hallazgo, prueba o incidencia" />
                <Button type="submit" tone="ghost">Agregar entrada</Button>
              </form>
            ) : null}
          </section>
        </div>
        <div className="space-y-4">
          {row.kind === "DIAGNOSTICO" ? (
            <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
              <h2 className="font-medium">Refacciones previstas</h2>
              <p className="mt-1 text-[var(--muted)]">
                Presolicitud durante el diagnóstico. Si el cliente autoriza, pasan a la orden de servicio.
              </p>
              {row.presolicitudes.length === 0 ? (
                <p className="mt-2 text-[var(--muted)]">Sin presolicitudes.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {row.presolicitudes.map((item) => (
                    <li key={item.id} className="border-t border-[var(--line)] pt-2">
                      <p>
                        {item.partNumber} · {item.description} · {PRESOLICITUD_LABEL[item.status] ?? item.status}
                      </p>
                      <p className="text-[var(--muted)]">
                        Cantidad {item.qtyRequested}
                        {item.link ? (
                          <>
                            {" "}
                            ·{" "}
                            <a href={item.link} className="text-[var(--accent)]" target="_blank" rel="noreferrer">
                              Referencia
                            </a>
                          </>
                        ) : null}
                      </p>
                      {canEditPresolicitud && item.status === "ACTIVA" ? (
                        <div className="mt-2 space-y-2">
                          <form action={updatePresolicitudAction} className="grid gap-2">
                            <input type="hidden" name="caseId" value={row.id} />
                            <input type="hidden" name="presolicitudId" value={item.id} />
                            <Field label="Número de parte">
                              <input name="partNumber" required defaultValue={item.partNumber} className={controlClass} />
                            </Field>
                            <Field label="Descripción">
                              <input name="description" required defaultValue={item.description} className={controlClass} />
                            </Field>
                            <Field label="Liga opcional">
                              <input name="link" defaultValue={item.link ?? ""} className={controlClass} />
                            </Field>
                            <Field label="Cantidad">
                              <input name="quantity" type="number" min={1} required defaultValue={item.qtyRequested} className={controlClass} />
                            </Field>
                            <Button type="submit" tone="ghost">
                              Guardar
                            </Button>
                          </form>
                          <form action={deletePresolicitudAction}>
                            <input type="hidden" name="caseId" value={row.id} />
                            <input type="hidden" name="presolicitudId" value={item.id} />
                            <Button type="submit" tone="ghost">
                              Quitar
                            </Button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canEditPresolicitud ? (
                <form action={createPresolicitudAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="caseId" value={row.id} />
                  <Field label="Número de parte">
                    <input name="partNumber" required className={controlClass} />
                  </Field>
                  <Field label="Descripción">
                    <input name="description" required className={controlClass} />
                  </Field>
                  <Field label="Liga opcional">
                    <input name="link" className={controlClass} />
                  </Field>
                  <Field label="Cantidad">
                    <input name="quantity" type="number" min={1} required className={controlClass} />
                  </Field>
                  <Button type="submit" tone="ghost">
                    Agregar
                  </Button>
                </form>
              ) : null}
            </section>
          ) : null}
          {row.kind === "OS" ? (
            <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
              <h2 className="font-medium">Refacciones</h2>
              {row.requests.length === 0 ? <p className="mt-2 text-[var(--muted)]">Sin solicitudes.</p> : (
                <ul className="mt-2 space-y-3">
                  {row.requests.map((request) => (
                    <li key={request.id}>
                      <p>{request.partNumber} · {request.description} · {request.status}</p>
                      <p className="text-[var(--muted)]">Solicitada {request.qtyRequested} · recibida {request.qtyReceived} · surtida {request.qtyIssued}</p>
                      {canWork && !closed && !readOnly ? (
                        <div className="mt-1 flex flex-wrap gap-2">
                          <form action={receivePartAction} className="flex gap-1">
                            <input type="hidden" name="caseId" value={row.id} />
                            <input type="hidden" name="requestId" value={request.id} />
                            <input type="hidden" name="version" value={request.version} />
                            <input name="quantity" type="number" min={1} required className="w-16 rounded-md border border-[var(--line)] px-2 py-1" />
                            <Button type="submit" tone="ghost">Recibir</Button>
                          </form>
                          <form action={issuePartAction} className="flex gap-1">
                            <input type="hidden" name="caseId" value={row.id} />
                            <input type="hidden" name="requestId" value={request.id} />
                            <input type="hidden" name="version" value={request.version} />
                            <input name="quantity" type="number" min={1} required className="w-16 rounded-md border border-[var(--line)] px-2 py-1" />
                            <Button type="submit" tone="ghost">Surtir</Button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canWork && !closed && !readOnly ? (
                <form action={requestPartAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="caseId" value={row.id} />
                  <Field label="Número de parte"><input name="partNumber" required className={controlClass} /></Field>
                  <Field label="Descripción"><input name="description" required className={controlClass} /></Field>
                  <Field label="Liga opcional"><input name="link" className={controlClass} /></Field>
                  <Field label="Cantidad"><input name="quantity" type="number" min={1} required className={controlClass} /></Field>
                  <Button type="submit" tone="ghost">Solicitar refacción</Button>
                </form>
              ) : null}
            </section>
          ) : null}
          {!readOnly ? (
            <>
            {canManage && !closed ? (
              <form action={assignCaseAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
                <h2 className="font-medium">Asignación</h2>
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <Field label="Responsable interno">
                  <select name="assigneeUserId" className={controlClass} defaultValue={row.assigneeUserId ?? ""}>
                    <option value="">Sin asignar</option>
                    {candidates.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </Field>
                {row.serviceCompany.code === "SYSTRON" ? (
                  <SupplierPicker
                    label="O servicio externo"
                    suppliers={suppliers}
                    defaultSupplierId={row.externalSupplierId ?? ""}
                    allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
                    allowEmpty
                    emptyLabel="Sin proveedor"
                  />
                ) : null}
                <Button type="submit" tone="ghost">Guardar asignación</Button>
              </form>
            ) : null}
            {canWork && (row.status === "EN_ESPERA" || row.status === "DEVUELTO") ? (
              <form action={startCaseAction}>
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <Button type="submit">Iniciar trabajo</Button>
              </form>
            ) : null}
            {canManage && row.kind === "DIAGNOSTICO" && (row.status === "PENDIENTE_VALIDACION" || (row.serviceCompany.code === "SERVOMOTORES" && row.status === "VALIDADO" && warranty && !row.warrantyDecision)) ? (
              <form action={validateAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
                <h2 className="font-medium">Validación</h2>
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <select name="decision" className={controlClass}>
                  {warranty ? <option value="VALIDA">Garantía válida</option> : <option value="VALIDAR">Validar</option>}
                  {warranty ? <option value="NO_PROCEDENTE">Garantía no procedente</option> : null}
                  <option value="DEVOLVER">Devolver a corrección</option>
                </select>
                <input name="reason" placeholder="Motivo si devuelves" className={controlClass} />
                <Button type="submit">Registrar validación</Button>
              </form>
            ) : null}
            {canWork && row.kind === "OS" && ["EN_REPARACION", "EN_ESPERA_REFACCIONES"].includes(row.status) ? (
              <form action={finishRepairAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
                <h2 className="font-medium">Cierre técnico</h2>
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <select name="outcome" className={controlClass}>
                  <option value="TERMINADA">Reparación terminada</option>
                  <option value="SIN_REPARACION">Sin reparación</option>
                </select>
                <textarea name="resultText" required rows={3} className={controlClass} />
                <Button type="submit">Cerrar técnicamente</Button>
              </form>
            ) : null}
            {row.externalSupplierId && canManage ? (
              <form action={externalDocumentAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
                <h2 className="font-medium">Documento del proveedor</h2>
                <p className="text-sm text-[var(--muted)]">Capturarlo no valida el diagnóstico.</p>
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <textarea name="document" required rows={3} className={controlClass} defaultValue={row.externalDocument ?? ""} />
                <Button type="submit" tone="ghost">Guardar documento</Button>
              </form>
            ) : null}
            {closed && canManage ? (
              <form action={reopenAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
                <h2 className="font-medium">Reabrir</h2>
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <input name="reason" required className={controlClass} placeholder="Motivo" />
                <Button type="submit" tone="ghost">Reabrir</Button>
              </form>
            ) : null}
            {row.kind === "OS" && row.status === "TERMINADA" && row.attention.attentionType !== "DIAGNOSTICO_GARANTIA" && !row.paidAt && (session.role === "CEO" || session.role === "ADMINISTRADOR") ? (
              <form action={markPaidAction}>
                <input type="hidden" name="caseId" value={row.id} />
                <Button type="submit" tone="ghost">Marcar reparación pagada</Button>
              </form>
            ) : null}
            {row.warrantyDecision === "NO_PROCEDENTE" && !row.commercialDecision && (session.role === "CEO" || session.role === "ADMINISTRADOR") ? (
              <form action={overrideWarrantyAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
                <h2 className="font-medium">Decisión comercial</h2>
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <select name="decision" className={controlClass}>
                  <option value="VALIDA">Aceptar como garantía</option>
                  <option value="COTIZAR">Enviar a cotización</option>
                </select>
                <input name="reason" required className={controlClass} placeholder="Motivo" />
                <Button type="submit">Guardar decisión</Button>
              </form>
            ) : null}
            </>
          ) : null}
          <HistoryTimeline items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
        </div>
      </DetailGrid>
    </>
  );
}
