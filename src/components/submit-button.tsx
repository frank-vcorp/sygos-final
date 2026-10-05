"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  tone = "primary",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  tone?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" tone={tone} className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ConfirmSubmit({
  message,
  children,
  pendingLabel = "Guardando…",
  tone = "danger",
}: {
  message: string;
  children: React.ReactNode;
  pendingLabel?: string;
  tone?: "primary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      tone={tone}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
