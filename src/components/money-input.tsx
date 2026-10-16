"use client";

import { useState } from "react";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";

const inputClass =
  "min-h-11 w-full rounded-lg border border-[#cbd8e6] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#087d99] focus-visible:ring-2 focus-visible:ring-[#c7e9f2] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function initialDisplay(value: string | number | readonly string[] | undefined) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  if (value === "") return "";
  const parsed = typeof value === "number" ? value : parseMoneyInput(value);
  return parsed != null ? formatMoneyInput(parsed) : String(value);
}

export function MoneyInput({
  className = "",
  defaultValue,
  wrapperClassName = "",
  name,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "defaultValue" | "step" | "value"> & {
  defaultValue?: string | number | readonly string[];
  wrapperClassName?: string;
}) {
  const [display, setDisplay] = useState(() => initialDisplay(defaultValue));

  return (
    <span className={`relative block ${wrapperClassName}`.trim()}>
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-[var(--muted)]">
        $
      </span>
      <input
        {...props}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        onChange={(event) => setDisplay(event.target.value)}
        onBlur={() => {
          const parsed = parseMoneyInput(display);
          setDisplay(parsed != null ? formatMoneyInput(parsed) : display.trim());
        }}
        placeholder={props.placeholder ?? "0.00"}
        className={`${inputClass} pl-7 ${className}`.trim()}
      />
    </span>
  );
}
