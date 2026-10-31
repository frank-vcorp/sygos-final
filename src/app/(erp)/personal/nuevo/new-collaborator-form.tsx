"use client";

import { useMemo, useState } from "react";
import { hireAction } from "../actions";
import { ActionLink, Badge, Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput } from "@/components/ui";
import {
  formatCollaboratorCredentialsMessage,
  generateCollaboratorPassword,
  suggestCollaboratorUsername,
} from "@/lib/collaborator-credentials";
import type { CollaboratorActivity, CommissionTier } from "@/lib/personnel";

export type RoleOption = {
  value: string;
  label: string;
  exemptBoss: boolean;
};

export function NewCollaboratorForm({
  companyName,
  today,
  roles,
  bosses,
}: {
  companyName: string;
  today: string;
  roles: RoleOption[];
  bosses: Array<{ id: string; name: string }>;
}) {
  const defaultRole = roles.find((r) => r.value === "VENTAS") ?? roles[0] ?? { value: "VENTAS", label: "Ventas", exemptBoss: false };

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(defaultRole.value);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(() => generateCollaboratorPassword(2026));
  const [suggestedPassword, setSuggestedPassword] = useState(() => generateCollaboratorPassword(3091));
  const [copied, setCopied] = useState(false);

  const [hireKind, setHireKind] = useState<"NUEVO" | "MIGRADO">("NUEVO");
  const [vacationBalance, setVacationBalance] = useState("");

  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [tiers, setTiers] = useState<CommissionTier[]>([
    { targetAmount: 0, kind: "PORCENTAJE", value: 0 },
  ]);

  const [activitiesEnabled, setActivitiesEnabled] = useState(false);
  const [activities, setActivities] = useState<CollaboratorActivity[]>([
    { name: "", targetCount: 1 },
  ]);

  const [bonusesEnabled, setBonusesEnabled] = useState(false);
  const [punctualityBonusEnabled, setPunctualityBonusEnabled] = useState(false);
  const [productivityBonusEnabled, setProductivityBonusEnabled] = useState(false);

  const usernameSuggestion = useMemo(() => suggestCollaboratorUsername(name), [name]);
  const selectedRoleOption = roles.find((r) => r.value === role) ?? defaultRole;

  const credentialsText = useMemo(
    () =>
      formatCollaboratorCredentialsMessage({
        name: name || "Colaborador",
        username: username || usernameSuggestion || "usuario",
        password,
        roleLabel: selectedRoleOption.label,
        companyName,
      }),
    [name, username, usernameSuggestion, password, selectedRoleOption.label, companyName],
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

  return (
    <FormPanel action={hireAction} className="max-w-5xl">
      {/* 1. Datos personales */}
      <FormSection
        title="1. Datos personales"
        description="Identidad y contacto directo del colaborador."
        columns={2}
      >
        <Field label="Nombre completo *">
          <input
            name="name"
            required
            value={name}
            onChange={(e) => {
              const nextName = e.target.value;
              const prevSuggestion = suggestCollaboratorUsername(name);
              setName(nextName);
              if (!username || username === prevSuggestion) {
                setUsername(suggestCollaboratorUsername(nextName));
              }
            }}
            placeholder="Ej. Juan Pérez López"
            className={controlClass}
          />
        </Field>
        <Field label="Teléfono *">
          <input
            name="phone"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej. 5512345678"
            className={controlClass}
          />
        </Field>
        <Field label="Fecha de nacimiento">
          <input name="birthDate" type="date" className={controlClass} />
        </Field>
        <Field label="Correo">
          <input name="email" type="email" placeholder="correo@empresa.mx" className={controlClass} />
        </Field>
        <Field label="Dirección" className="md:col-span-2">
          <input name="address" placeholder="Calle, número, colonia, ciudad" className={controlClass} />
        </Field>
        <Field label="Contacto de emergencia" className="md:col-span-2">
          <input name="emergencyContact" placeholder="Nombre, parentesco y teléfono" className={controlClass} />
        </Field>
      </FormSection>

      {/* 2. Acceso al sistema y credenciales */}
      <FormSection
        title="2. Acceso al sistema y credenciales"
        description="Al guardar, SYGOS envía usuario, contraseña, rol y nombre al teléfono del colaborador por la sesión de WhatsApp (Baileys)."
        columns={2}
      >
        <Field label="Rol en el sistema *">
          <select
            name="role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
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
          label="Usuario (login / identificador) *"
          hint={
            usernameSuggestion
              ? `Sugerencia automática a partir del nombre: ${usernameSuggestion}`
              : "Escribe el nombre completo para generar una sugerencia."
          }
        >
          <div className="flex gap-2">
            <input
              name="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={usernameSuggestion || "juan.perez"}
              autoComplete="off"
              className={controlClass}
            />
            {usernameSuggestion ? (
              <Button
                type="button"
                tone="ghost"
                className="shrink-0 text-xs"
                onClick={() => setUsername(usernameSuggestion)}
              >
                Aceptar sugerencia
              </Button>
            ) : null}
          </div>
        </Field>

        <Field
          label="Contraseña *"
          hint={`Sugerencia disponible: ${suggestedPassword}`}
          className="md:col-span-2"
        >
          <div className="flex flex-wrap gap-2">
            <input
              name="password"
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              className={`${controlClass} flex-1 font-mono`}
            />
            <Button
              type="button"
              tone="ghost"
              className="shrink-0 text-xs"
              onClick={() => {
                setPassword(suggestedPassword);
                setSuggestedPassword(generateCollaboratorPassword());
              }}
            >
              Aceptar sugerencia ({suggestedPassword})
            </Button>
            <Button
              type="button"
              tone="ghost"
              className="shrink-0 text-xs"
              onClick={() => {
                const fresh = generateCollaboratorPassword();
                setPassword(fresh);
                setSuggestedPassword(generateCollaboratorPassword());
              }}
            >
              Sugerir contraseña
            </Button>
          </div>
        </Field>

        <div className="md:col-span-2 rounded-xl border border-sky-200/90 bg-sky-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="ok">Credenciales listas</Badge>
              <span className="text-xs font-semibold text-slate-700">
                Vista previa para envío por WhatsApp ({companyName})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                tone="ghost"
                className="min-h-8 px-3 py-1 text-xs"
                onClick={handleCopyCredentials}
              >
                {copied ? "Copiado" : "Copiar credenciales"}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            El envío ocurre al guardar el colaborador. Si WhatsApp no está vinculado, el alta sigue y puedes copiar las credenciales.
          </p>
          <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-5">
            <div>
              <span className="block text-[11px] font-medium text-slate-400">Nombre</span>
              <strong className="font-semibold text-slate-900">{name || "—"}</strong>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-400">Usuario</span>
              <strong className="font-mono font-semibold text-slate-900">
                {username || usernameSuggestion || "—"}
              </strong>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-400">Contraseña</span>
              <strong className="font-mono font-semibold text-slate-900">{password || "—"}</strong>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-400">Rol</span>
              <strong className="font-semibold text-slate-900">{selectedRoleOption.label}</strong>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-400">Teléfono</span>
              <strong className="font-semibold text-slate-900">{phone || "—"}</strong>
            </div>
          </div>
        </div>
      </FormSection>

      {/* 3. Datos laborales */}
      <FormSection
        title="3. Datos laborales"
        description="Tipo de ingreso, ubicación en la estructura y jornada operativa."
        columns={2}
      >
        <Field label={selectedRoleOption.exemptBoss ? "Jefe directo" : "Jefe directo *"}>
          <select
            name="bossUserId"
            required={!selectedRoleOption.exemptBoss}
            defaultValue={bosses[0]?.id ?? ""}
            className={controlClass}
          >
            <option value="">Selecciona jefe directo</option>
            {bosses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo de ingreso *">
          <select
            name="hireKind"
            required
            value={hireKind}
            onChange={(e) => setHireKind(e.target.value === "MIGRADO" ? "MIGRADO" : "NUEVO")}
            className={controlClass}
          >
            <option value="NUEVO">Nuevo</option>
            <option value="MIGRADO">Migrado</option>
          </select>
        </Field>
        <Field
          label="Fecha de ingreso *"
          hint={
            hireKind === "MIGRADO"
              ? "Fecha original de ingreso del colaborador."
              : "Un ingreso nuevo inicia con saldo de vacaciones en 0."
          }
        >
          <input name="hiredAt" type="date" required defaultValue={today} className={controlClass} />
        </Field>
        {hireKind === "MIGRADO" ? (
          <Field label="Saldo inicial de vacaciones *" hint="Días hábiles. Se permiten medios días.">
            <input
              name="vacationBalance"
              type="number"
              required
              min={0}
              step={0.5}
              value={vacationBalance}
              onChange={(e) => setVacationBalance(e.target.value)}
              className={controlClass}
            />
          </Field>
        ) : null}
        <Field label="Horario / jornada *">
          <input
            name="workSchedule"
            required
            defaultValue="Lunes a viernes 09:00 a 18:00"
            className={controlClass}
          />
        </Field>
      </FormSection>

      {/* 4. Datos fiscales y de seguridad social */}
      <FormSection
        title="4. Datos fiscales y de seguridad social"
        description="Identificadores obligatorios para nómina y timbrado."
        columns={3}
      >
        <Field label="RFC *">
          <input name="rfc" required placeholder="XAXX010101000" className={controlClass} />
        </Field>
        <Field label="CURP *">
          <input name="curp" required placeholder="18 caracteres" className={controlClass} />
        </Field>
        <Field label="NSS *">
          <input name="nss" required placeholder="Número de seguridad social" className={controlClass} />
        </Field>
      </FormSection>

      {/* 5. Sueldo */}
      <FormSection
        title="5. Sueldo"
        description="Dos sueldos diarios en pesos (MXN). Ambos son obligatorios; usa 0 si uno no aplica."
        columns={2}
      >
        <Field label="Sueldo diario timbrado *">
          <MoneyInput name="dailyStamped" required min="0" />
        </Field>
        <Field label="Sueldo diario sin timbrar *">
          <MoneyInput name="dailyCash" required min="0" />
        </Field>
      </FormSection>

      {/* 6. Cuenta bancaria */}
      <FormSection
        title="6. Cuenta bancaria"
        description="Datos bancarios para dispersión de pagos."
        columns={2}
      >
        <Field label="Banco *">
          <input name="bankName" required placeholder="Ej. BBVA, Banorte, Santander" className={controlClass} />
        </Field>
        <Field label="Cuenta / CLABE *">
          <input name="bankAccount" required placeholder="18 dígitos CLABE o número de cuenta" className={controlClass} />
        </Field>
      </FormSection>

      {/* 7. Comisión por facturación */}
      <FormSection
        title="7. Comisión por facturación (opcional)"
        description="Escalafones ordenados de menor a mayor según meta de facturación en pesos. Permite 0% o $0."
        columns={1}
      >
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            name="commissionEnabled"
            value="1"
            checked={commissionEnabled}
            onChange={(e) => setCommissionEnabled(e.target.checked)}
          />
          Habilitada
        </label>
        {commissionEnabled ? (
          <div className="space-y-3 pt-2">
            {tiers.map((tier, idx) => (
              <div key={idx} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
                <Field label="Meta de facturación ($)">
                  <input
                    name="tierTargetAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={tier.targetAmount}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...tier, targetAmount: Number(e.target.value) };
                      setTiers(next);
                    }}
                    className={controlClass}
                  />
                </Field>
                <Field label="Tipo">
                  <select
                    name="tierKind"
                    value={tier.kind}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = {
                        ...tier,
                        kind: e.target.value === "MONTO" ? "MONTO" : "PORCENTAJE",
                      };
                      setTiers(next);
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
                      const next = [...tiers];
                      next[idx] = { ...tier, value: Number(e.target.value) };
                      setTiers(next);
                    }}
                    className={controlClass}
                  />
                </Field>
                <div>
                  <Button
                    type="button"
                    tone="ghost"
                    className="w-full text-xs"
                    onClick={() => setTiers(tiers.filter((_, i) => i !== idx))}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              tone="ghost"
              className="text-xs"
              onClick={() => setTiers([...tiers, { targetAmount: 0, kind: "PORCENTAJE", value: 0 }])}
            >
              + Agregar escalafón
            </Button>
          </div>
        ) : null}
      </FormSection>

      {/* 8. Actividades */}
      <FormSection
        title="8. Actividades (opcional)"
        description="Actividades y número objetivo para seguimiento en Agenda comercial."
        columns={1}
      >
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            name="activitiesEnabled"
            value="1"
            checked={activitiesEnabled}
            onChange={(e) => setActivitiesEnabled(e.target.checked)}
          />
          Habilitadas
        </label>
        {activitiesEnabled ? (
          <div className="space-y-3 pt-2">
            {activities.map((act, idx) => (
              <div key={idx} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
                <Field label="Nombre de la actividad">
                  <input
                    name="activityName"
                    value={act.name}
                    placeholder="Ej. Visitas comerciales"
                    onChange={(e) => {
                      const next = [...activities];
                      next[idx] = { ...act, name: e.target.value };
                      setActivities(next);
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
                      const next = [...activities];
                      next[idx] = { ...act, targetCount: Number(e.target.value) };
                      setActivities(next);
                    }}
                    className={controlClass}
                  />
                </Field>
                <div>
                  <Button
                    type="button"
                    tone="ghost"
                    className="w-full text-xs"
                    onClick={() => setActivities(activities.filter((_, i) => i !== idx))}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              tone="ghost"
              className="text-xs"
              onClick={() => setActivities([...activities, { name: "", targetCount: 1 }])}
            >
              + Agregar actividad
            </Button>
          </div>
        ) : null}
      </FormSection>

      {/* 9. Bonos */}
      <FormSection
        title="9. Bonos (opcional)"
        description="Bonos predefinidos con activación individual y monto en pesos."
        columns={1}
      >
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            name="bonusesEnabled"
            value="1"
            checked={bonusesEnabled}
            onChange={(e) => setBonusesEnabled(e.target.checked)}
          />
          Bonos habilitados
        </label>
        {bonusesEnabled ? (
          <div className="mt-2 space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="grid items-center gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  name="punctualityBonusEnabled"
                  value="1"
                  checked={punctualityBonusEnabled}
                  onChange={(e) => setPunctualityBonusEnabled(e.target.checked)}
                />
                Asistencia y puntualidad
              </label>
              <Field label="Monto ($)">
                <MoneyInput name="punctualityBonus" defaultValue="0" min="0" />
              </Field>
            </div>
            <div className="grid items-center gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  name="productivityBonusEnabled"
                  value="1"
                  checked={productivityBonusEnabled}
                  onChange={(e) => setProductivityBonusEnabled(e.target.checked)}
                />
                Producción
              </label>
              <Field label="Monto ($)">
                <MoneyInput name="productivityBonus" defaultValue="0" min="0" />
              </Field>
            </div>
          </div>
        ) : null}
      </FormSection>

      <FormActions note="Los campos marcados con * son obligatorios.">
        <ActionLink href="/personal" tone="ghost">
          Cancelar
        </ActionLink>
        <Button type="submit">Guardar colaborador</Button>
      </FormActions>
    </FormPanel>
  );
}
