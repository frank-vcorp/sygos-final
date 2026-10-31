"use client";

import { useMemo, useState } from "react";
import {
  activitiesSectionAction,
  bankAccountSectionAction,
  bonusesSectionAction,
  collaboratorCredentialsSectionAction,
  commissionSectionAction,
  fiscalDataSectionAction,
  laborDataSectionAction,
  personalDataSectionAction,
  salaryAction,
} from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Badge, Button, Card, controlClass, Field, MoneyInput, Table, Td, Th } from "@/components/ui";
import {
  buildCollaboratorWhatsAppUrl,
  formatCollaboratorCredentialsMessage,
  generateCollaboratorPassword,
  suggestCollaboratorUsername,
} from "@/lib/collaborator-credentials";
import { money } from "@/lib/money";
import type { CollaboratorActivity, CommissionTier } from "@/lib/personnel";

type CollaboratorDatosProps = {
  isCeo: boolean;
  companyName: string;
  justCreated?: boolean;
  collaborator: {
    id: string;
    version: number;
    name: string;
    username: string;
    role: string;
    roleLabel: string;
    credentialPasswordPreview: string | null;
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
    hireKindLabel: string;
    workSchedule: string;
    isActive: boolean;
    hasClosedProcesses: boolean;
    rfc: string | null;
    curp: string | null;
    nss: string | null;
    dailyStamped: number;
    dailyCash: number;
    overtimeRate: number;
    bankName: string | null;
    bankAccount: string | null;
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
  roles: Array<{ value: string; label: string }>;
};

function SectionHeader({
  title,
  isCeo,
  onEdit,
  editLabel = "Editar",
}: {
  title: string;
  isCeo: boolean;
  onEdit: () => void;
  editLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
      {isCeo ? (
        <Button type="button" tone="ghost" className="min-h-8 px-3 py-1 text-xs" onClick={onEdit}>
          {editLabel}
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

export function CollaboratorDatosTab({
  isCeo,
  companyName,
  justCreated = false,
  collaborator,
  bosses,
  roles,
}: CollaboratorDatosProps) {
  const [modal, setModal] = useState<
    | null
    | "personales"
    | "credenciales"
    | "laborales"
    | "fiscales"
    | "sueldo"
    | "banco"
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

  const [credUsername, setCredUsername] = useState(collaborator.username);
  const [credRole, setCredRole] = useState(collaborator.role);
  const [credNewPassword, setCredNewPassword] = useState(collaborator.credentialPasswordPreview ?? "");
  const [credSuggestedPass, setCredSuggestedPass] = useState(() => generateCollaboratorPassword(4021));
  const [copied, setCopied] = useState(false);

  const activePasswordPreview = collaborator.credentialPasswordPreview || "(sin contraseña visible; regenera para compartir)";

  const waUrl = useMemo(
    () =>
      buildCollaboratorWhatsAppUrl({
        phone: collaborator.phone,
        name: collaborator.name,
        username: collaborator.username,
        password: collaborator.credentialPasswordPreview || "Solicita cambio al administrador",
        roleLabel: collaborator.roleLabel,
        companyName,
      }),
    [
      collaborator.phone,
      collaborator.name,
      collaborator.username,
      collaborator.credentialPasswordPreview,
      collaborator.roleLabel,
      companyName,
    ],
  );

  const credentialsText = useMemo(
    () =>
      formatCollaboratorCredentialsMessage({
        name: collaborator.name,
        username: collaborator.username,
        password: collaborator.credentialPasswordPreview || "Solicita cambio al administrador",
        roleLabel: collaborator.roleLabel,
        companyName,
      }),
    [
      collaborator.name,
      collaborator.username,
      collaborator.credentialPasswordPreview,
      collaborator.roleLabel,
      companyName,
    ],
  );

  const handleCopyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(credentialsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const usernameSuggestion = useMemo(
    () => suggestCollaboratorUsername(collaborator.name),
    [collaborator.name],
  );

  return (
    <div className="space-y-4">
      {isCeo && justCreated && collaborator.credentialPasswordPreview ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-emerald-950">
                Colaborador creado — Credenciales listas para compartir
              </p>
              <p className="mt-0.5 text-xs text-emerald-800">
                Usuario: <strong className="font-mono">{collaborator.username}</strong> · Contraseña:{" "}
                <strong className="font-mono">{collaborator.credentialPasswordPreview}</strong> · Teléfono:{" "}
                <strong>{collaborator.phone ?? "—"}</strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" tone="ghost" className="min-h-8 px-3 py-1 text-xs" onClick={handleCopyCredentials}>
                {copied ? "Copiado" : "Copiar credenciales"}
              </Button>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center justify-center rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
              >
                Enviar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      ) : null}

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

      {/* Acceso al sistema y credenciales */}
      <Card className="p-5">
        <SectionHeader
          title="Acceso al sistema y credenciales"
          isCeo={isCeo}
          onEdit={() => {
            setCredUsername(collaborator.username);
            setCredRole(collaborator.role);
            setCredNewPassword(collaborator.credentialPasswordPreview ?? generateCollaboratorPassword());
            setModal("credenciales");
          }}
        />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DataItem label="Usuario (login)" value={<span className="font-mono">{collaborator.username}</span>} />
          <DataItem label="Rol en el sistema" value={collaborator.roleLabel} />
          {isCeo ? (
            <DataItem
              label="Contraseña"
              value={<span className="font-mono">{activePasswordPreview}</span>}
            />
          ) : null}
          {isCeo ? (
            <div>
              <dt className="text-xs font-medium text-slate-400">Compartir acceso</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                <Button
                  type="button"
                  tone="ghost"
                  className="min-h-8 px-2.5 py-1 text-xs"
                  onClick={handleCopyCredentials}
                >
                  {copied ? "Copiado" : "Copiar credenciales"}
                </Button>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-8 items-center justify-center rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
                >
                  Enviar por WhatsApp
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {/* 2. Datos laborales */}
      <Card className="p-5">
        <SectionHeader title="Datos laborales" isCeo={isCeo} onEdit={() => setModal("laborales")} />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DataItem label="Puesto" value={collaborator.jobTitle} />
          <DataItem label="Jefe directo" value={collaborator.bossName ?? "—"} />
          <DataItem label="Fecha de ingreso" value={collaborator.hiredAtFormatted} />
          <DataItem label="Tipo de ingreso" value={collaborator.hireKindLabel} />
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
        <dl className="grid gap-4 sm:grid-cols-2">
          <DataItem label="Sueldo diario timbrado" value={money(collaborator.dailyStamped)} />
          <DataItem label="Sueldo diario sin timbrar" value={money(collaborator.dailyCash)} />
        </dl>
      </Card>

      {/* 5. Cuenta bancaria */}
      <Card className="p-5">
        <SectionHeader title="Cuenta bancaria" isCeo={isCeo} onEdit={() => setModal("banco")} />
        <dl className="grid gap-4 sm:grid-cols-2">
          <DataItem label="Banco" value={collaborator.bankName} />
          <DataItem label="Cuenta / CLABE" value={collaborator.bankAccount} />
        </dl>
      </Card>

      {/* 6. Comisión por facturación */}
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

      {/* 7. Actividades */}
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

      {/* 8. Bonos */}
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
      {/* Modal: Datos personales */}
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
              <input name="phone" required defaultValue={collaborator.phone ?? ""} className={controlClass} />
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

      {/* Modal: Credenciales de acceso */}
      <FormOverlayDialog
        open={modal === "credenciales"}
        onClose={() => setModal(null)}
        title="Editar credenciales de acceso"
        titleId="edit-credenciales-dialog"
        wide
      >
        <form action={collaboratorCredentialsSectionAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rol en el sistema">
              <select
                name="role"
                value={credRole}
                onChange={(e) => setCredRole(e.target.value)}
                className={controlClass}
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Usuario (login)"
              hint={usernameSuggestion ? `Sugerencia: ${usernameSuggestion}` : undefined}
            >
              <div className="flex gap-2">
                <input
                  name="username"
                  required
                  value={credUsername}
                  onChange={(e) => setCredUsername(e.target.value)}
                  className={controlClass}
                />
                {usernameSuggestion && credUsername !== usernameSuggestion ? (
                  <Button
                    type="button"
                    tone="ghost"
                    className="shrink-0 text-xs"
                    onClick={() => setCredUsername(usernameSuggestion)}
                  >
                    Aceptar sugerencia
                  </Button>
                ) : null}
              </div>
            </Field>
            <Field
              label="Contraseña (visible para enviar al colaborador)"
              hint={`Sugerencia disponible: ${credSuggestedPass}`}
              className="sm:col-span-2"
            >
              <div className="flex flex-wrap gap-2">
                <input
                  name="newPassword"
                  type="text"
                  value={credNewPassword}
                  onChange={(e) => setCredNewPassword(e.target.value)}
                  placeholder="Escribe o genera una nueva contraseña"
                  className={`${controlClass} flex-1 font-mono`}
                />
                <Button
                  type="button"
                  tone="ghost"
                  className="shrink-0 text-xs"
                  onClick={() => {
                    setCredNewPassword(credSuggestedPass);
                    setCredSuggestedPass(generateCollaboratorPassword());
                  }}
                >
                  Aceptar sugerencia ({credSuggestedPass})
                </Button>
                <Button
                  type="button"
                  tone="ghost"
                  className="shrink-0 text-xs"
                  onClick={() => {
                    const fresh = generateCollaboratorPassword();
                    setCredNewPassword(fresh);
                    setCredSuggestedPass(generateCollaboratorPassword());
                  }}
                >
                  Sugerir contraseña
                </Button>
              </div>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar credenciales</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal: Datos laborales */}
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
              <input name="jobTitle" required defaultValue={collaborator.jobTitle} className={controlClass} />
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

      {/* Modal: Datos fiscales y de seguridad social */}
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
              <input name="rfc" required defaultValue={collaborator.rfc ?? ""} className={controlClass} />
            </Field>
            <Field label="CURP">
              <input name="curp" required defaultValue={collaborator.curp ?? ""} className={controlClass} />
            </Field>
            <Field label="NSS">
              <input name="nss" required defaultValue={collaborator.nss ?? ""} className={controlClass} />
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

      {/* Modal: Sueldo */}
      <FormOverlayDialog
        open={modal === "sueldo"}
        onClose={() => setModal(null)}
        title="Editar sueldo"
        titleId="edit-sueldo-dialog"
      >
        <form action={salaryAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <input type="hidden" name="overtimeRate" value={collaborator.overtimeRate} />
          <p className="text-xs text-slate-500">
            El cambio aplica hacia adelante sin modificar nóminas o procesos históricos ya cerrados.
          </p>
          <Field label="Sueldo diario timbrado">
            <MoneyInput name="dailyStamped" required defaultValue={collaborator.dailyStamped} min="0" />
          </Field>
          <Field label="Sueldo diario sin timbrar">
            <MoneyInput name="dailyCash" required defaultValue={collaborator.dailyCash} min="0" />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar sueldo</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal: Cuenta bancaria */}
      <FormOverlayDialog
        open={modal === "banco"}
        onClose={() => setModal(null)}
        title="Editar cuenta bancaria"
        titleId="edit-banco-dialog"
      >
        <form action={bankAccountSectionAction} className="space-y-4">
          <input type="hidden" name="collaboratorId" value={collaborator.id} />
          <input type="hidden" name="version" value={collaborator.version} />
          <input type="hidden" name="tab" value="datos" />
          <Field label="Banco">
            <input
              name="bankName"
              required
              defaultValue={collaborator.bankName ?? ""}
              placeholder="Ej. BBVA, Banorte, Santander"
              className={controlClass}
            />
          </Field>
          <Field label="Cuenta / CLABE">
            <input
              name="bankAccount"
              required
              defaultValue={collaborator.bankAccount ?? ""}
              placeholder="18 dígitos CLABE o número de cuenta"
              className={controlClass}
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar cuenta bancaria</Button>
          </div>
        </form>
      </FormOverlayDialog>

      {/* Modal: Comisión por facturación */}
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

      {/* Modal: Actividades */}
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

      {/* Modal: Bonos */}
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
