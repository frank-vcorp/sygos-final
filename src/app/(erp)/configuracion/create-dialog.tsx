"use client";

import { useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button } from "@/components/ui";

export function CreateDialog({
  label,
  title,
  titleId,
  wide,
  children,
}: {
  label: string;
  title: string;
  titleId: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>{label}</Button>
      {open ? (
        <FormOverlayDialog open onClose={() => setOpen(false)} title={title} titleId={titleId} wide={wide}>
          {children}
        </FormOverlayDialog>
      ) : null}
    </>
  );
}
