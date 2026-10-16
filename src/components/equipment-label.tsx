"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, Card } from "@/components/ui";

type EquipmentLabelProps = {
  equipmentHref: string;
  equipmentFolio: string;
  kind: "EQUI" | "MOT";
  typeName: string | null;
  brandName: string | null;
  model: string;
  serial: string | null;
  autoOpen?: boolean;
};

export function EquipmentLabel({
  equipmentHref,
  equipmentFolio,
  kind,
  typeName,
  brandName,
  model,
  serial,
  autoOpen = false,
}: EquipmentLabelProps) {
  const [open, setOpen] = useState(autoOpen);
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const target = typeof window === "undefined" ? equipmentHref : `${window.location.origin}${equipmentHref}`;
  const identity = [typeName, brandName, model].filter(Boolean).join(" · ");

  useEffect(() => {
    if (!open) return;
    let active = true;
    void import("qrcode")
      .then((qrcode) => qrcode.toDataURL(target))
      .then((dataUrl) => {
        if (active) setQr(dataUrl);
      })
      .catch(() => {
        if (active) setQrError(true);
      });
    return () => {
      active = false;
    };
  }, [open, target]);

  const labelBody = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[#f7fafc] px-5 py-4 print:hidden">
        <div>
          <p className="text-sm text-[var(--muted)]">Colócala en el equipo después de verificar sus datos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => window.print()} disabled={!qr}>
            Imprimir etiqueta
          </Button>
          {autoOpen ? (
            <Link href={equipmentHref} className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium">
              Continuar
            </Link>
          ) : (
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>Cerrar</Button>
          )}
        </div>
      </div>
      <div id="equipment-label-print" className="flex items-center justify-center p-5 print:p-0">
        <div className="grid w-full max-w-[520px] grid-cols-[1fr_150px] gap-4 rounded-xl border-2 border-[#0b1f3a] bg-white p-4 text-[#0b1f3a] print:w-[80mm] print:max-w-none print:grid-cols-[1fr_32mm] print:gap-2 print:rounded-none print:p-3">
          <div className="min-w-0 self-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#087d99]">SYGOS</p>
            <p className="mt-1 text-3xl font-bold leading-none tracking-tight print:text-2xl">{equipmentFolio}</p>
            <p className="mt-3 text-sm font-semibold leading-5 print:mt-2 print:text-xs">{identity || "Equipo sin identificación"}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#5a6b7d]">{kind === "MOT" ? "Motor" : "Equipo"}</p>
            {serial ? <p className="mt-1 break-all text-xs text-[#5a6b7d]">Serie: {serial}</p> : null}
          </div>
          <div className="flex min-h-[150px] items-center justify-center border-l border-[#d4dee8] pl-3 print:min-h-0 print:pl-2">
            {qr ? <img src={qr} alt={`QR del equipo ${equipmentFolio}`} className="h-[140px] w-[140px] print:h-[30mm] print:w-[30mm]" /> : qrError ? <p className="text-center text-xs text-[var(--danger)]">No se pudo generar el QR.</p> : <p className="text-center text-xs text-[var(--muted)]">Generando QR…</p>}
          </div>
        </div>
      </div>
      <style>{`@media print { body * { visibility: hidden !important; } #equipment-label-print, #equipment-label-print * { visibility: visible !important; } #equipment-label-print { position: absolute; inset: 0; } @page { size: 80mm 50mm; margin: 0; } }`}</style>
    </>
  );

  if (autoOpen) {
    return (
      <>
        <Button type="button" tone="ghost" onClick={() => setOpen(true)}>
          Ver / reimprimir etiqueta
        </Button>
        <FormOverlayDialog
          open={open}
          onClose={() => setOpen(false)}
          title="Etiqueta de identificación"
          titleId="equipment-label-overlay"
          wide
        >
          {labelBody}
        </FormOverlayDialog>
      </>
    );
  }

  if (!open) {
    return (
      <Button type="button" tone="ghost" onClick={() => setOpen(true)}>
        Ver / reimprimir etiqueta
      </Button>
    );
  }

  return (
    <Card className="overflow-hidden border-[#b9ccdc]">
      <div className="border-b border-[var(--line)] bg-[#f7fafc] px-5 py-4 print:hidden">
        <h2 className="font-semibold text-[#0b1f3a]">Etiqueta de identificación</h2>
      </div>
      {labelBody}
    </Card>
  );
}
