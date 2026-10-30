"use client";

import { useState } from "react";
import {
  activitiesSectionAction,
  bonusesSectionAction,
  commissionSectionAction,
  fiscalDataSectionAction,
  laborDataSectionAction,
  personalDataSectionAction,
  salaryAction,
} from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Badge, Button, Card, controlClass, Field, MoneyInput, Table, Td, Th } from "@/components/ui";
import { money } from "@/lib/money";
import type { CollaboratorActivity, CommissionTier } from "@/lib/personnel";

type CollaboratorDatosProps = {
  isCeo: boolean;
  collaborator: {
    id: string;
    version: number;
    name: string;
    birthDate: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    emergencyContact: string | null;
    jobTitle: string;
    bossUserId: string | null;
    bossName: string | null;
    hiredAtIso: string;
    hiredAtFormatted: string;
    workSchedule: string;
    isActive: boolean;
    hasClosedProcesses: boolean;
    rfc: string | null;
    curp: string | null;
    nss: string | null;
    dailyStamped: number;
    dailyCash: number;
    overtimeRate: number;
    commissionEnabled: boolean;
    commissionTiers: CommissionTier[];
    activitiesEnabled: boolean;
    activities: CollaboratorActivity[];
    bonusesEnabled: boolean;
    punctualityBonusEnabled: boolean;
    punctualityBonus: number;
    productivityBonusEnabled: boolean;
    productivityBonus: number;
  };
  bosses: Array<{ id: string; name: string }>;
};

function SectionHeader({
  title,
  isCeo,
  onEdit,
}: {
  title: string;
  isCeo: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
      {isCeo ? (
        <Button type="button" tone="ghost" className="min-h-8 px-3 py-1 text-xs" onClick={onEdit}>
          Editar
        </Button>
      ) : null}
    </div>
  );
}

function DataItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export function CollaboratorDatosTab({ isCeo, collaborator, bosses }: CollaboratorDatosProps) {
  const [modal, setModal] = useState<
    | null
    | "personales"
    | "laborales"
    | "fiscales"
    | "sueldo"
    | "comision"
    | "actividades"
    | "bonos"
  >(null);

  const [tiersDraft, setTiersDraft] = useState<CommissionTier[]>(
    collaborator.commissionTiers.length > 0
      ? collaborator.commissionTiers
      : [{ targetAmount: 0, kind: "PORCENTAJE", value: 0 }],
  );
  const [commissionEnabledDraft, setCommissionEnabledDraft] = useState(collaborator.commissionEnabled);

  const [activitiesDraft, setActivitiesDraft] = useState<CollaboratorActivity[]>(
    collaborator.activities.length > 0
      ? collaborator.activities
      : [{ name: "", targetCount: 1 }],
  );
  const [activitiesEnabledDraft, setActivitiesEnabledDraft] = useState(collaborator.activitiesEnabled);

  const [bonusesEnabledDraft, setBonusesEnabledDraft] = useState(collaborator.bonusesEnabled);
  const [punctualityEnabledDraft, setPunctualityEnabledDraft] = useState(collaborator.punctualityBonusEnabled);
  const [productivityEnabledDraft, setProductivityEnabledDraft] = useState(collaborator.productivityBonusEnabled);

  const sueldoVigente = collaborator.dailyStamped + collaborator.dailyCash;

  return (
    <div className="space-y-4">
      {/* 1. Datos personales */}
      <Card className="p-5">
        <SectionHeader title="Datos personales" isCeo={isCeo} onEdit={() => setModal("personales")} />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DataItem label="Nombre" value={collaborator.name} />
          <DataItem label="Fecha de nacimiento" value={collaborator.birthDate} />
          <DataItem label="Teléfono" value={collaborator.phone} />
          <DataItem label="Correo" value={collaborator.email} />
          <DataItem label="Dirección" value={collaborator.address} />
          <DataItem label="Contacto de emergencia" value={collaborator.emergencyContact} />
        </dl>
      </Card>

      {/* 2. Datos laborales */}
      <Card className="p-5">
        <SectionHeader title="Datos laborales" isCeo={isCeo} onEdit={() => setModal("laborales")} />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DataItem label="Puesto" value={collaborator.jobTitle} />
          <DataItem label="Jefe directo" value={collaborator.bossName ?? "—"} />
          <DataItem label="Fecha de ingreso" value={collaborator.hiredAtFormatted} />
          <DataItem label="Horario / jornada" value={collaborator.workSchedule} />
          <DataItem
            label="Estado"
            value={
              <Badge tone={collaborator.isActive ? "ok" : "warn"}>
                {collaborator.isActive ? "Activo" : "Inactivo"}
              </Badge>
            }
          />
        </dl>
      </Card>

      {/* 3. Datos fiscales y de seguridad social */}
      <Card className="p-5">
        <SectionHeader
          title="Datos fiscales y de seguridad social"
          isCeo={isCeo}
          onEdit={() => setModal("fiscales")}
        />
        <dl className="grid gap-4 sm:grid-cols-3">
          <DataItem label="RFC" value={collaborator.rfc} />
          <DataItem label="CURP" value={collaborator.curp} />
          <DataItem label="NSS" value={collaborator.nss} />
        </dl>
      </Card>

      {/* 4. Sueldo */}
      <Card className="p-5">
        <SectionHeader title="Sueldo" isCeo={isCeo} onEdit={() => setModal("sueldo")} />
        <dl className="grid gap-4 sm:grid-cols-3">
          <DataItem label="Sueldo vigente" value={money(sueldoVigente)} />
        </dl>
      </Card>

      {/* 5. Comisión por facturación */}
      <Card className="p-5">
        <SectionHeader
          title="Comisión por facturación"
          isCeo={isCeo}
          onEdit={() => {
            setCommissionEnabledDraft(collaborator.commissionEnabled);
            setTiersDraft(
              collaborator.commissionTiers.length > 0
                ? collaborator.commissionTiers
                : [{ targetAmount: 0, kind: "PORCENTAJE", value: 0 }],
            );
            setModal("comision");
          }}
        />
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-xs font-medium text-slate-400">Estado:</span>
          <Badge tone={collaborator.commissionEnabled ? "ok" : "neutral"}>
            {collaborator.commissionEnabled ? "Habilitada" : "Deshabilitada"}
          </Badge>
        </div>
        {collaborator.commissionTiers.length === 0 ? (
          <p className="text-xs text-slate-400">Sin escalafones configurados.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Meta de facturación</Th>
                <Th>Tipo de comisión</Th>
                <Th>Valor de comisión</Th>
              </tr>
            </thead>
            <tbody>
              {collaborator.commissionTiers.map((tier, idx) => (
                <tr key={idx}>
                  <Td>{money(tier.targetAmount)}</Td>
                  <Td>{tier.kind === "MONTO" ? "Monto" : "Porcentaje"}</Td>
                  <Td>{tier.kind === "MONTO" ? money(tier.value) : `${tier.value}%`}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* 6. Actividades */}
      <Card className="p-5">
        <SectionHeader
          title="Actividades"
          isCeo={isCeo}
          onEdit={() => {
            setActivitiesEnabledDraft(collaborator.activitiesEnabled);
            setActivitiesDraft(
              collaborator.activities.length > 0
                ? collaborator.activities
                : [{ name: "", targetCount: 1 }],
            );
            setModal("actividades");
          }}
        />
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-xs font-medium text-slate-400">Estado:</span>
          <Badge tone={collaborator.activitiesEnabled ? "ok" : "neutral"}>
            {collaborator.activitiesEnabled ? "Habilitadas" : "Deshabilitadas"}
          </Badge>
        </div>
        {collaborator.activities.length === 0 ? (
          <p className="text-xs text-slate-400">Sin actividades configuradas.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nombre de la actividad</Th>
                <Th>Número objetivo</Th>
              </tr>
            </thead>
            <tbody>
              {collaborator.activities.map((act, idx) => (
                <tr key={idx}>
                  <Td>{act.name}</Td>
                  <Td>{act.targetCount}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* 7. Bonos */}
      <Card className="p-5">
        <SectionHeader
          title="Bonos"
          isCeo={isCeo}
          onEdit={() => {
            setBonusesEnabledDraft(collaborator.bonusesEnabled);
            setPunctualityEnabledDraft(collaborator.punctualityBonusEnabled);
            setProductivityEnabledDraft(collaborator.productivityBonusEnabled);
            setModal("bonos");
          }}
        />
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-xs font-medium text-slate-400">Estado general:</span>
          <Badge tone={collaborator.bonusesEnabled ? "ok" : "neutral"}>
            {collaborator.bonusesEnabled ? "Habilitados" : "Deshabilitados"}
          </Badge>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Bono</Th>
              <Th>Aplica</Th>
              <Th>Monto</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Asistencia y puntualidad</Td>
              <Td>
                <Badge tone={collaborator.bonusesEnabled && collaborator.punctualityBonusEnabled ? "ok" : "neutral"}>
                  {collaborator.bonusesEnabled && collaborator.punctualityBonusEnabled ? "Habilitado" : "Deshabilitado"}
                </Badge>
              </Td>
              <Td>{money(collaborator.punctualityBonus)}</Td>
            </tr>
            <tr>
              <Td>Producción</Td>
              <Td>
                <Badge tone={collaborator.bonusesEnabled && collaborator.productivityBonusEnabled ? "ok" : "neutral"}>
                  {collaborator.bonusesEnabled && collaborator.productivityBonusEnabled ? "Habilitado" : "Deshabilitado"}
                </Badge>
              </Td>
              <Td>{money(collaborator.productivityBonus)}</Td>
            </tr>
          </tbody>
        </Table>
      </Card>

      {/* MODALS FOR CEO */}
      {/* Modal 1: Datos personales */}
      <FormOverlayDialog
        open={modal === "personales"}
        onClose={() => setModal(null)}
        title="Editar datos personales"
        titleId="edit-datos-personales-dialog"
        wide
      >
        <form action={personalDataSectionAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input name="name" required defaultValue={collaborator.name} className={controlClass} />
            </Field>
            <Field label="Fecha de nacimiento">
              <input name="birthDate" type="date" defaultValue={collaborator.birthDate ?? ""} className={controlClass} />
            </Field>
            <Field label="Teléfono">
              <input name="phone" defaultValue={collaborator.phone ?? ""} className={controlClass} />
            </Field>
            <Field label="Correo">
              <input name="email" type="email" defaultValue={collaborator.email ?? ""} className={controlClass} />
            </Field>
            <Field label="Dirección" className="sm:col-span-2">
              <input name="address" defaultValue={collaborator.address ?? ""} className={controlClass} />
            </Field>
            <Field label="Contacto de emergencia" className="sm:col-span-2">
              <input name="emergencyContact" defaultValue={collaborator.emergencyContact ?? ""} className={controlClass} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal 2: Datos laborales */}
      <FormOverlayDialog
        open={modal === "laborales"}
        onClose={() => setModal(null)}
        title="Editar datos laborales"
        titleId="edit-datos-laborales-dialog"
        wide
      >
        <form action={laborDataSectionAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Puesto">
              <input name="jobTitle" defaultValue={collaborator.jobTitle} className={controlClass} />
            </Field>
            <Field label="Jefe directo">
              <select name="bossUserId" defaultValue={collaborator.bossUserId ?? ""} className={controlClass}>
                <option value="">Sin jefe directo</option>
                {bosses.map((boss) => (
                  <option key={boss.id} value={boss.id}>
                    {boss.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Fecha de ingreso"
              hint={
                collaborator.hasClosedProcesses
                  ? "Conserva su valor histórico porque ya existen nóminas autorizadas."
                  : undefined
              }
            >
              <input
                name="hiredAt"
                type="date"
                required
                defaultValue={collaborator.hiredAtIso}
                readOnly={collaborator.hasClosedProcesses}
                className={controlClass}
              />
            </Field>
            <Field label="Horario / jornada">
              <input name="workSchedule" required defaultValue={collaborator.workSchedule} className={controlClass} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal 3: Datos fiscales y de seguridad social */}
      <FormOverlayDialog
        open={modal === "fiscales"}
        onClose={() => setModal(null)}
        title="Editar datos fiscales y de seguridad social"
        titleId="edit-datos-fiscales-dialog"
      >
        <form action={fiscalDataSectionAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <div className="grid gap-4">
            <Field label="RFC">
              <input name="rfc" defaultValue={collaborator.rfc ?? ""} className={controlClass} />
            </Field>
            <Field label="CURP">
              <input name="curp" defaultValue={collaborator.curp ?? ""} className={controlClass} />
            </Field>
            <Field label="NSS">
              <input name="nss" defaultValue={collaborator.nss ?? ""} className={controlClass} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal 4: Sueldo */}
      <FormOverlayDialog
        open={modal === "sueldo"}
        onClose={() => setModal(null)}
        title="Editar sueldo vigente"
        titleId="edit-sueldo-dialog"
      >
        <form action={salaryAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <input type="hidden" name="overtimeRate" value={collaborator.overtimeRate} />
          <input type="hidden" name="dailyCash" value={0} />
          <p className="text-xs text-slate-500">
            El cambio aplica hacia adelante sin modificar nóminas o procesos históricos ya cerrados.
          </p>
          <Field label="Sueldo vigente">
            <MoneyInput name="sueldoVigente" defaultValue={sueldoVigente} min="0" />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar sueldo</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal 5: Comisión por facturación */}
      <FormOverlayDialog
        open={modal === "comision"}
        onClose={() => setModal(null)}
        title="Editar comisión por facturación"
        titleId="edit-comision-dialog"
        wide
      >
        <form action={commissionSectionAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              name="commissionEnabled"
              value="1"
              checked={commissionEnabledDraft}
              onChange={(e) => setCommissionEnabledDraft(e.target.checked)}
            />
            Habilitada
          </label>
          <p className="text-xs text-slate-500">
            Los escalafones se ordenan de menor a mayor según la meta de facturación en pesos. Se permite configurar 0% o $0.
          </p>
          <div className="space-y-3">
            {tiersDraft.map((tier, idx) => (
              <div key={idx} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
                <Field label="Meta de facturación ($)">
                  <input
                    name="tierTargetAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={tier.targetAmount}
                    onChange={(e) => {
                      const next = [...tiersDraft];
                      next[idx] = { ...tier, targetAmount: Number(e.target.value) };
                      setTiersDraft(next);
                    }}
                    className={controlClass}
                  />
                </Field>
                <Field label="Tipo">
                  <select
                    name="tierKind"
                    value={tier.kind}
                    onChange={(e) => {
                      const next = [...tiersDraft];
                      next[idx] = {
                        ...tier,
                        kind: e.target.value === "MONTO" ? "MONTO" : "PORCENTAJE",
                      };
                      setTiersDraft(next);
                    }}
                    className={controlClass}
                  >
                    <option value="PORCENTAJE">Porcentaje (%)</option>
                    <option value="MONTO">Monto ($)</option>
                  </select>
                </Field>
                <Field label="Valor">
                  <input
                    name="tierValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={tier.value}
                    onChange={(e) => {
                      const next = [...tiersDraft];
                      next[idx] = { ...tier, value: Number(e.target.value) };
                      setTiersDraft(next);
                    }}
                    className={controlClass}
                  />
                </Field>
                <div>
                  <Button
                    type="button"
                    tone="ghost"
                    className="w-full text-xs"
                    onClick={() => setTiersDraft(tiersDraft.filter((_, i) => i !== idx))}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            tone="ghost"
            className="text-xs"
            onClick={() => setTiersDraft([...tiersDraft, { targetAmount: 0, kind: "PORCENTAJE", value: 0 }])}
          >
            + Agregar escalafón
          </Button>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar comisión</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal 6: Actividades */}
      <FormOverlayDialog
        open={modal === "actividades"}
        onClose={() => setModal(null)}
        title="Editar actividades"
        titleId="edit-actividades-dialog"
        wide
      >
        <form action={activitiesSectionAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              name="activitiesEnabled"
              value="1"
              checked={activitiesEnabledDraft}
              onChange={(e) => setActivitiesEnabledDraft(e.target.checked)}
            />
            Habilitadas
          </label>
          <div className="space-y-3">
            {activitiesDraft.map((act, idx) => (
              <div key={idx} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
                <Field label="Nombre de la actividad">
                  <input
                    name="activityName"
                    value={act.name}
                    placeholder="Ej. Visitas comerciales"
                    onChange={(e) => {
                      const next = [...activitiesDraft];
                      next[idx] = { ...act, name: e.target.value };
                      setActivitiesDraft(next);
                    }}
                    className={controlClass}
                  />
                </Field>
                <Field label="Número objetivo">
                  <input
                    name="activityTarget"
                    type="number"
                    min="0"
                    step="1"
                    value={act.targetCount}
                    onChange={(e) => {
                      const next = [...activitiesDraft];
                      next[idx] = { ...act, targetCount: Number(e.target.value) };
                      setActivitiesDraft(next);
                    }}
                    className={controlClass}
                  />
                </Field>
                <div>
                  <Button
                    type="button"
                    tone="ghost"
                    className="w-full text-xs"
                    onClick={() => setActivitiesDraft(activitiesDraft.filter((_, i) => i !== idx))}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            tone="ghost"
            className="text-xs"
            onClick={() => setActivitiesDraft([...activitiesDraft, { name: "", targetCount: 1 }])}
          >
            + Agregar actividad
          </Button>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar actividades</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal 7: Bonos */}
      <FormOverlayDialog
        open={modal === "bonos"}
        onClose={() => setModal(null)}
        title="Editar bonos"
        titleId="edit-bonos-dialog"
        wide
      >
        <form action={bonusesSectionAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              name="bonusesEnabled"
              value="1"
              checked={bonusesEnabledDraft}
              onChange={(e) => setBonusesEnabledDraft(e.target.checked)}
            />
            Bonos habilitados
          </label>
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="grid items-center gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  name="punctualityBonusEnabled"
                  value="1"
                  checked={punctualityEnabledDraft}
                  onChange={(e) => setPunctualityEnabledDraft(e.target.checked)}
                />
                Asistencia y puntualidad
              </label>
              <Field label="Monto ($)">
                <MoneyInput name="punctualityBonus" defaultValue={collaborator.punctualityBonus} min="0" />
              </Field>
            </div>
            <div className="grid items-center gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  name="productivityBonusEnabled"
                  value="1"
                  checked={productivityEnabledDraft}
                  onChange={(e) => setProductivityEnabledDraft(e.target.checked)}
                />
                Producción
              </label>
              <Field label="Monto ($)">
                <MoneyInput name="productivityBonus" defaultValue={collaborator.productivityBonus} min="0" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar bonos</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </div>
  );
}
