"use client";

import { useEffect, useMemo, useState } from "react";
import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { Button, controlClass, Field } from "@/components/ui";

export type ServiceEquipmentOption = {
  id: string;
  folio: string;
  model: string;
  clientId: string;
  kind: string;
};

export function ServiceEquipmentPicker({
  equipment,
  clientId,
  companyCode,
  types,
  brands,
  models,
  warranty = false,
}: {
  equipment: ServiceEquipmentOption[];
  clientId: string;
  companyCode: string;
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
  warranty?: boolean;
}) {
  const [equipmentId, setEquipmentId] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    if (!clientId) return [];
    return equipment.filter((row) => row.clientId === clientId);
  }, [equipment, clientId]);

  useEffect(() => {
    setEquipmentId("");
    setShowNew(false);
  }, [clientId]);

  const openNew = () => {
    setEquipmentId("");
    setShowNew(true);
  };

  const closeNew = () => setShowNew(false);

  if (warranty) {
    return (
      <Field label="Equipo" hint="La garantía exige un equipo que ya tuvo una reparación pagada.">
        <select
          name="equipmentId"
          required
          className={controlClass}
          value={equipmentId}
          onChange={(event) => setEquipmentId(event.target.value)}
        >
          <option value="">Selecciona</option>
          {equipment.map((item) => (
            <option key={item.id} value={item.id}>{item.folio} · {item.model}</option>
          ))}
        </select>
      </Field>
    );
  }

  return (
    <>
      <Field
        label="Equipo del cliente"
        hint={
          !clientId
            ? "Selecciona un cliente para ver sus equipos."
            : filtered.length === 0
              ? "Este cliente no tiene equipos registrados. Usa el alta de equipo."
              : "Elige un equipo existente o regístralo nuevo."
        }
      >
        <select
          name="equipmentId"
          className={controlClass}
          value={equipmentId}
          disabled={!clientId || showNew}
          onChange={(event) => {
            setEquipmentId(event.target.value);
            if (event.target.value) setShowNew(false);
          }}
        >
          <option value="">Selecciona</option>
          {filtered.map((item) => (
            <option key={item.id} value={item.id}>
              {item.folio} · {item.model} ({item.kind})
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          tone="ghost"
          className="min-h-10 border border-dashed border-[var(--accent)] text-[var(--accent)]"
          disabled={!clientId}
          onClick={openNew}
        >
          + Alta de equipo
        </Button>
        {equipmentId ? (
          <span className="text-xs text-[var(--muted)]">Usando equipo existente.</span>
        ) : null}
        {!clientId ? (
          <span className="text-xs text-[var(--muted)]">Primero elige el cliente.</span>
        ) : null}
      </div>

      {showNew ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-new-equipment-title"
        >
          <div className="max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--line)] bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
              <h3 id="service-new-equipment-title" className="text-sm font-semibold text-[#0b1f3a]">
                Alta de equipo
              </h3>
              <Button type="button" tone="ghost" className="min-h-9 px-2 text-xs" onClick={closeNew}>
                Cerrar
              </Button>
            </div>
            <div className="grid gap-3 p-4">
              <Field label="EQUI o MOT">
                <select name="equipmentKind" className={controlClass} defaultValue={companyCode === "SERVOMOTORES" ? "MOT" : "EQUI"}>
                  {companyCode === "SYSTRON" ? <option value="EQUI">EQUI</option> : null}
                  <option value="MOT">MOT</option>
                </select>
              </Field>
              <EquipmentCatalogFields types={types} brands={brands} models={models} />
              <Field label="Serie"><input name="serial" className={controlClass} /></Field>
              <Button type="button" className="w-full sm:w-auto" onClick={closeNew}>
                Listo — continuar con el servicio
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
