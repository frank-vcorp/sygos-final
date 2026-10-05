"use client";

import { useState } from "react";
import { controlClass, Field } from "@/components/ui";
import { MOVEMENT_LABEL, MOVEMENT_REASONS, type MovementKind } from "@/lib/custody";

export function MovementReasonFields({ movements }: { movements: MovementKind[] }) {
  const [movement, setMovement] = useState<MovementKind>(movements[0]);
  const reasons = MOVEMENT_REASONS[movement];
  return (
    <>
      <Field label="Movimiento">
        <select
          name="movement"
          required
          className={controlClass}
          value={movement}
          onChange={(event) => setMovement(event.target.value as MovementKind)}
        >
          {movements.map((item) => (
            <option key={item} value={item}>{MOVEMENT_LABEL[item]}</option>
          ))}
        </select>
      </Field>
      <Field label="Motivo">
        <select name="reason" required className={controlClass} key={movement} defaultValue={reasons[0]}>
          {reasons.map((reason) => (
            <option key={reason} value={reason}>{reason}</option>
          ))}
        </select>
      </Field>
    </>
  );
}
