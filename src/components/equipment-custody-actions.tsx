"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { FormOverlayDialog } from "@/components/overlay-dialog";

export function EquipmentCustodyActions({
  showMovement,
  showAttention,
  movement,
  attention,
  movementTitle = "Registrar movimiento",
  movementButtonLabel = "Registrar movimiento",
}: {
  showMovement: boolean;
  showAttention: boolean;
  movement: React.ReactNode;
  attention: React.ReactNode;
  movementTitle?: string;
  movementButtonLabel?: string;
}) {
  const [open, setOpen] = useState<null | "movement" | "attention">(null);
  if (!showMovement && !showAttention) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {showMovement ? (
          <Button type="button" onClick={() => setOpen("movement")}>{movementButtonLabel}</Button>
        ) : null}
        {showAttention ? (
          <Button type="button" tone="ghost" onClick={() => setOpen("attention")}>Nueva atención</Button>
        ) : null}
      </div>
      <FormOverlayDialog
        open={open === "movement"}
        onClose={() => setOpen(null)}
        title={movementTitle}
        titleId="equipment-move-overlay"
        wide
      >
        {movement}
      </FormOverlayDialog>
      <FormOverlayDialog
        open={open === "attention"}
        onClose={() => setOpen(null)}
        title="Nueva atención"
        titleId="equipment-attention-overlay"
        wide
      >
        {attention}
      </FormOverlayDialog>
    </>
  );
}
