"use client";

import { useMemo, useState, type ReactNode } from "react";
import { MobileCard, ResponsiveData, Table, Td } from "@/components/ui";
import { compareSortValues, sortRowsByColumn, type SortDirection } from "@/lib/list-sort";

export type SortableColumnDef<T> = {
  id: string;
  header: ReactNode;
  sortable?: boolean;
  value: (row: T) => unknown;
  cell: (row: T) => ReactNode;
};

export type ListInitialOrder =
  | { mode: "preserve" }
  | { mode: "column"; columnId: string; direction: SortDirection };

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join(" ");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return flattenText(props?.children);
  }
  return "";
}

function SortTh({
  label,
  active,
  direction,
  sortable,
  onClick,
}: {
  label: ReactNode;
  active: boolean;
  direction: SortDirection | null;
  sortable: boolean;
  onClick: () => void;
}) {
  const text = flattenText(label);
  if (!sortable) {
    return (
      <th className="border-b border-slate-200/80 px-3 py-2.5 text-xs font-medium text-slate-500">
        <span>{label}</span>
      </th>
    );
  }
  return (
    <th className="border-b border-slate-200/80 px-3 py-2.5 text-xs font-medium text-slate-500">
      <button
        type="button"
        onClick={onClick}
        className="group inline-flex w-full items-center gap-1.5 text-left font-medium text-slate-600 transition-colors hover:text-slate-900"
        aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
        title={text ? `Ordenar por ${text}` : "Ordenar columna"}
      >
        <span>{label}</span>
        <span className={`text-[10px] tabular-nums ${active ? "text-[#0e5696]" : "text-slate-300 group-hover:text-slate-400"}`} aria-hidden>
          {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function SortableResponsiveList<T>({
  rows,
  columns,
  rowKey,
  initialOrder = { mode: "preserve" },
  mobileCard,
  rowClassName,
  stickyHeader,
}: {
  rows: T[];
  columns: SortableColumnDef<T>[];
  rowKey: (row: T) => string;
  initialOrder?: ListInitialOrder;
  mobileCard: (row: T) => ReactNode;
  rowClassName?: (row: T) => string | undefined;
  stickyHeader?: boolean;
}) {
  const defaultColumn =
    initialOrder.mode === "column"
      ? { columnId: initialOrder.columnId, direction: initialOrder.direction }
      : null;

  const [sort, setSort] = useState<{ columnId: string; direction: SortDirection } | null>(null);

  const sortedRows = useMemo(() => {
    if (initialOrder.mode === "preserve" && !sort) return rows;
    const columnId = sort?.columnId ?? defaultColumn?.columnId;
    const direction = sort?.direction ?? defaultColumn?.direction ?? "desc";
    if (!columnId) return rows;
    const column = columns.find((col) => col.id === columnId);
    if (!column?.sortable) return rows;
    return sortRowsByColumn(rows, column.value, direction);
  }, [rows, columns, sort, defaultColumn, initialOrder.mode]);

  const toggle = (columnId: string) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column?.sortable) return;
    setSort((prev) => {
      if (prev?.columnId === columnId) {
        return { columnId, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      const direction =
        defaultColumn?.columnId === columnId
          ? defaultColumn.direction === "asc"
            ? "desc"
            : "asc"
          : compareSortValues(column.value(rows[0]!), column.value(rows[1] ?? rows[0]!)) <= 0
            ? "asc"
            : "desc";
      return { columnId, direction };
    });
  };

  const activeId = sort?.columnId ?? defaultColumn?.columnId ?? null;
  const activeDir = sort?.direction ?? defaultColumn?.direction ?? null;

  return (
    <ResponsiveData
      table={
        <Table stickyHeader={stickyHeader}>
          <thead>
            <tr>
              {columns.map((col) => (
                <SortTh
                  key={col.id}
                  label={col.header}
                  sortable={col.sortable !== false}
                  active={activeId === col.id}
                  direction={activeId === col.id ? activeDir : null}
                  onClick={() => toggle(col.id)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={rowKey(row)} className={rowClassName?.(row)}>
                {columns.map((col) => (
                  <Td key={col.id}>{col.cell(row)}</Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      }
      cards={sortedRows.map((row) => mobileCard(row))}
    />
  );
}