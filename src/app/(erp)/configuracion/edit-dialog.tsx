"use client";

import { useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button } from "@/components/ui";

export function ConfigEditDialog({
  title,
  titleId,
  wide,
  children,
  label = "Editar",
}: {
  title: string;
  titleId: string;
  wide?: boolean;
  children: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" tone="ghost" className="min-h-9 px-2 text-xs" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <FormOverlayDialog open onClose={() => setOpen(false)} title={title} titleId={titleId} wide={wide}>
          {children}
        </FormOverlayDialog>
      ) : null}
    </>
  );
}
