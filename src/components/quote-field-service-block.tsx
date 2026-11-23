"use client";

import { useEffect, useMemo, useState } from "react";
import type { ServiceEquipmentOption } from "@/components/service-equipment-picker";
import { controlClass, Field, FormBlock } from "@/components/ui";

export function QuoteFieldServiceBlock({
  equipment,
  clientId,
}: {
  equipment: ServiceEquipmentOption[];
  clientId: string;
}) {
  const clientEquipment = useMemo(
    () => equipment.filter((row) => row.clientId === clientId),
    [equipment, clientId],
  );
  const [equipmentId, setEquipmentId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setEquipmentId("");
    setBrand("");
    setModel("");
    setSerial("");
    setDescription("");
  }, [clientId]);

  useEffect(() => {
    if (!equipmentId) return;
    const row = clientEquipment.find((item) => item.id === equipmentId);
    if (!row) return;
    setBrand(row.brandName ?? "");
    setModel(row.model ?? "");
    setSerial(row.serial ?? "");
  }, [equipmentId, clientEquipment]);

  return (
    <FormBlock
      title="2. Máquina y servicio"
      description="Captura los datos del equipo en sitio. Gerencia asignará horas y tarifa después."
      columns={1}
    >
      {clientId ? (
        <Field label="Equipo en cartera (opcional)" hint="Si eliges uno, se llenan marca, modelo y serie.">
          <select
            name="equipmentId"
            className={controlClass}
            value={equipmentId}
            onChange={(event) => setEquipmentId(event.target.value)}
          >
            <option value="">Captura manual</option>
            {clientEquipment.map((row) => (
              <option key={row.id} value={row.id}>
                {[row.folio, row.brandName, row.model, row.serial].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Marca" hint="Obligatorio.">
          <input
            name="fieldServiceBrand"
            className={controlClass}
            required
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
          />
        </Field>
        <Field label="Modelo" hint="Obligatorio.">
          <input
            name="fieldServiceModel"
            className={controlClass}
            required
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
        </Field>
        <Field label="N. de serie" hint="Obligatorio.">
          <input
            name="fieldServiceSerial"
            className={controlClass}
            required
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descripción del servicio" hint="Alcance del trabajo en campo.">
            <textarea
              name="fieldServiceDescription"
              className={`${controlClass} min-h-24`}
              required
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej. Ajuste de parámetros y revisión de conexiones en sitio."
            />
          </Field>
        </div>
      </div>
    </FormBlock>
  );
}