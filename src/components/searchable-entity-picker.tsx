"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { controlClass } from "@/components/ui";

export type PickerOption = { id: string; name: string };

function key(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX").trim();
}

export function SearchableEntityPicker({
  label, name, options, selectedId, onSelect, required = false, hint,
  emptyLabel = "Selecciona", allowEmpty = false, createLabel, onCreate,
}: {
  label: string;
  name: string;
  options: PickerOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  required?: boolean;
  hint?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
  createLabel?: string;
  onCreate?: (typedName: string) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(options.find((row) => row.id === selectedId)?.name ?? "");
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const selectedName = options.find((row) => row.id === selectedId)?.name ?? "";

  useEffect(() => {
    inputRef.current?.setCustomValidity(!selectedId && query.trim() ? "Selecciona una opción de la lista." : "");
  }, [selectedId, query]);

  useEffect(() => {
    if (selectedId && selectedName) {
      setQuery(selectedName);
      setDirty(false);
    }
  }, [selectedId, selectedName]);

  const matches = useMemo(() => {
    if (!dirty || !query.trim()) return options;
    const term = key(query);
    return options.filter((row) => key(row.name).includes(term));
  }, [options, query, dirty]);

  const canCreate = Boolean(onCreate && (!dirty || !query.trim() || !options.some((row) => key(row.name) === key(query))));
  const rows: Array<{ kind: "option"; id: string; name: string } | { kind: "empty" } | { kind: "create" }> = [
    ...(canCreate ? [{ kind: "create" as const }] : []),
    ...(allowEmpty ? [{ kind: "empty" as const }] : []),
    ...matches.map((row) => ({ kind: "option" as const, id: row.id, name: row.name })),
  ];

  function choose(index: number) {
    const row = rows[index];
    if (!row) return;
    if (row.kind === "create") {
      setOpen(false);
      onCreate?.(dirty ? query.trim() : "");
      return;
    }
    const nextId = row.kind === "empty" ? "" : row.id;
    onSelect(nextId);
    setQuery(row.kind === "empty" ? "" : row.name);
    setDirty(false);
    setOpen(false);
  }

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id + "-list"}
          aria-activedescendant={open && rows.length ? id + "-option-" + highlight : undefined}
          aria-describedby={hint ? id + "-hint" : undefined}
          placeholder={emptyLabel}
          className={controlClass}
          required={required}
          title={"Selecciona un " + label.toLocaleLowerCase("es-MX") + " de la lista."}
          value={query}
          onFocus={() => { setOpen(true); setHighlight(0); setDirty(false); }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              if (selectedId) setQuery(selectedName);
            }, 140);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setDirty(true);
            setHighlight(0);
            if (selectedId) onSelect("");
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setHighlight((current) => event.key === "ArrowDown"
                ? Math.min(current + 1, Math.max(rows.length - 1, 0))
                : Math.max(current - 1, 0));
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              choose(highlight);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <input type="hidden" name={name} value={selectedId} />
        {open ? (
          <ul id={id + "-list"} role="listbox" aria-label={label} className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-1 shadow-[0_16px_36px_rgba(20,45,75,0.16)]">
            {rows.length === 0 ? <li className="px-3 py-3 text-sm text-[var(--muted)]">No hay coincidencias.</li> : rows.map((row, index) => (
              <li key={row.kind === "option" ? row.id : row.kind} id={id + "-option-" + index} role="option" aria-selected={index === highlight} className={row.kind === "create" ? "mb-1 border-b border-[var(--line)] pb-1" : ""}>
                <button type="button" className={"w-full rounded-lg px-3 py-2.5 text-left text-sm " + (index === highlight ? "bg-[var(--accent-soft)]" : "hover:bg-[#f3f8fb]") + (row.kind === "create" ? " font-semibold text-[var(--accent)]" : "")}
                  onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
                  {row.kind === "option" ? row.name : row.kind === "empty" ? emptyLabel : "+ " + createLabel}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {hint ? <p id={id + "-hint"} className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
