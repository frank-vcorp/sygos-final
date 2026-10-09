"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, controlClass } from "@/components/ui";

export function ClientesFilter({ query, estado }: { query: string; estado: string }) {
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [est, setEst] = useState(estado || "activos");
  const skipDebounce = useRef(false);

  useEffect(() => {
    setQ(query);
    setEst(estado || "activos");
  }, [query, estado]);

  function pushSearch(nextQ: string, nextEst: string) {
    const params = new URLSearchParams();
    const trimmed = nextQ.trim();
    if (trimmed) params.set("q", trimmed);
    if (nextEst === "inactivos") params.set("estado", "inactivos");
    const href = params.toString() ? `/clientes?${params}` : "/clientes";
    router.replace(href);
  }

  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false;
      return;
    }
    const trimmed = q.trim();
    if (trimmed === query.trim() && est === (estado || "activos")) return;
    const timer = window.setTimeout(() => pushSearch(q, est), 350);
    return () => window.clearTimeout(timer);
  }, [q, est, query, estado]);

  return (
    <form
      className="mb-4 flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        skipDebounce.current = true;
        pushSearch(q, est);
      }}
    >
      <input
        name="q"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Nombre, razón social o RFC"
        className={`${controlClass} sm:min-w-[12rem] sm:flex-1`}
        autoComplete="off"
      />
      <select
        name="estado"
        value={est}
        onChange={(event) => setEst(event.target.value)}
        className={`${controlClass} sm:w-auto`}
      >
        <option value="activos">Activos</option>
        <option value="inactivos">Inactivos</option>
      </select>
      <Button type="submit" tone="ghost">
        Buscar
      </Button>
      {query.trim() ? (
        <Button type="button" tone="ghost" onClick={() => { setQ(""); setEst("activos"); skipDebounce.current = true; router.replace("/clientes"); }}>
          Limpiar
        </Button>
      ) : null}
    </form>
  );
}
