"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { controlClass, Td } from "@/components/ui";
import { money } from "@/lib/money";
import { SAT_UNIT_OPTIONS } from "@/lib/sat-unit-options";
import {
  SAT_PRODSERV_SEARCH_MIN_LEN,
  satProdServLabel,
  searchSatProdServ,
} from "@/lib/sat-prodserv-search";
import { catalogKey } from "@/lib/catalog-key";

type BillingLineRow = {
  id: string;
  concept: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  amount: number;
  satProductKey: string | null;
  satUnitKey: string | null;
  taxability: string;
};

function SatProdServCombobox({
  name,
  defaultValue = "",
  required,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const items = useMemo(() => {
    if (value.trim().length < SAT_PRODSERV_SEARCH_MIN_LEN) return [];
    return searchSatProdServ(value);
  }, [value]);

  const rows = useMemo(() => {
    const digits = value.replace(/\D/g, "");
    const exact = digits.length === 8;
    const list: Array<{ entry: { key: string; description: string } }> = items.map((entry) => ({ entry }));
    if (exact && !items.some((row) => row.key === digits)) {
      list.push({ entry: { key: digits, description: "Clave manual" } });
    }
    return list;
  }, [items, value]);

  useEffect(() => {
    setHighlight(0);
  }, [rows.length, value]);

  function pickKey(key: string) {
    setValue(key);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, Math.max(rows.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && rows.length > 0) {
      event.preventDefault();
      const row = rows[highlight];
      if (row) pickKey(row.entry.key);
      return;
    }
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <div className="relative min-w-[9.5rem]">
      <input type="hidden" name={name} value={value.replace(/\D/g, "").slice(0, 8)} />
      <input
        aria-label="Clave producto o servicio SAT"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        required={required}
        className={`${controlClass} text-xs`}
        placeholder="Clave (8 díg.)"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {open && rows.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-48 w-max min-w-full overflow-y-auto rounded-md border border-[var(--line)] bg-white text-xs shadow-md"
        >
          {rows.map((row, index) => {
            const active = index === highlight;
            return (
              <li key={row.entry.key} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`block w-full px-2 py-1.5 text-left ${active ? "bg-[var(--accent-soft)]" : "hover:bg-[#f3f5f6]"}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickKey(row.entry.key)}
                >
                  {satProdServLabel(row.entry)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function SatUnitCombobox({
  name,
  defaultValue = "",
  required,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(defaultValue);
  const [unitKey, setUnitKey] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    setQuery(defaultValue);
    setUnitKey(defaultValue);
  }, [defaultValue]);

  const options = SAT_UNIT_OPTIONS;
  const filtered = useMemo(() => {
    const key = catalogKey(query);
    if (key.length < SAT_PRODSERV_SEARCH_MIN_LEN) return options;
    return options.filter(
      (row) => catalogKey(row.id).includes(key) || catalogKey(row.name).includes(key) || catalogKey(row.label).includes(key),
    );
  }, [options, query]);

  useEffect(() => {
    setHighlight(0);
  }, [filtered.length, query]);

  function pick(id: string, label: string) {
    setUnitKey(id);
    setQuery(label);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && filtered.length > 0) {
      event.preventDefault();
      const row = filtered[highlight];
      if (row) pick(row.id, row.label);
      return;
    }
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <div className="relative min-w-[7rem]">
      <input type="hidden" name={name} value={unitKey} />
      <input
        ref={inputRef}
        aria-label="Clave unidad SAT"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        required={required}
        className={`${controlClass} text-xs`}
        placeholder="Unidad"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setUnitKey(event.target.value.trim().toUpperCase().slice(0, 8));
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {open && filtered.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-40 w-max min-w-full overflow-y-auto rounded-md border border-[var(--line)] bg-white text-xs shadow-md"
        >
          {filtered.map((row, index) => {
            const active = index === highlight;
            return (
              <li key={row.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`block w-full px-2 py-1.5 text-left ${active ? "bg-[var(--accent-soft)]" : "hover:bg-[#f3f5f6]"}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(row.id, row.label)}
                >
                  {row.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function BillingLineSatEditor({
  documentId,
  lines,
  saveAction,
  canEdit,
}: {
  documentId: string;
  lines: BillingLineRow[];
  saveAction: (formData: FormData) => void | Promise<void>;
  canEdit: boolean;
}) {
  if (!canEdit) {
    return (
      <>
        {lines.map((line) => (
          <tr key={line.id}>
            <Td>{line.concept}</Td>
            <Td>{line.quantity}</Td>
            <Td>{money(line.unitPrice)}</Td>
            <Td>{line.discountAmount > 0 ? money(line.discountAmount) : "—"}</Td>
            <Td className="text-xs text-[var(--muted)]">
              {line.satProductKey || "—"} · {line.satUnitKey || "—"} · Obj {line.taxability || "02"}
            </Td>
            <Td>{money(line.amount)}</Td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <>
      {lines.map((line) => (
        <tr key={line.id}>
          <Td>{line.concept}</Td>
          <Td>{line.quantity}</Td>
          <Td>{money(line.unitPrice)}</Td>
          <Td>{line.discountAmount > 0 ? money(line.discountAmount) : "—"}</Td>
          <Td>
            <form action={saveAction} className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
              <input type="hidden" name="documentId" value={documentId} />
              <input type="hidden" name="lineId" value={line.id} />
              <SatProdServCombobox name="satProductKey" defaultValue={line.satProductKey ?? ""} required />
              <SatUnitCombobox name="satUnitKey" defaultValue={line.satUnitKey ?? ""} required />
              <span className="text-[10px] text-[var(--muted)] whitespace-nowrap">Obj {line.taxability || "02"}</span>
              <button
                type="submit"
                className="inline-flex min-h-8 items-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
              >
                Guardar
              </button>
            </form>
          </Td>
          <Td>{money(line.amount)}</Td>
        </tr>
      ))}
    </>
  );
}