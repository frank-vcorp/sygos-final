"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function isLinkActive(pathname: string, search: URLSearchParams, href: string, locationHash: string): boolean {
  const hashIdx = href.indexOf("#");
  const wantHash = hashIdx >= 0 ? href.slice(hashIdx) : "";
  const pathQuery = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const [path, queryString] = pathQuery.split("?", 2);
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  if (wantHash) return locationHash === wantHash;
  if (!queryString) {
    if (pathname !== path) return pathname.startsWith(`${path}/`);
    return !search.get("vista");
  }
  const expected = new URLSearchParams(queryString.split("#")[0] ?? queryString);
  for (const [key, value] of expected.entries()) {
    if (search.get(key) !== value) return false;
  }
  return true;
}

export function SideNav({
  groups,
}: {
  groups: Array<{
    title: string | null;
    direct?: boolean;
    links: Array<{ href: string; label: string; createHref?: string }>;
  }>;
}) {
  const path = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams ?? new URLSearchParams();
  const [locationHash, setLocationHash] = useState("");
  useEffect(() => {
    const sync = () => setLocationHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [path]);
  return (
    <nav className="space-y-1 px-3 pb-5">
      {groups.map((group) => {
        if (group.direct && group.title && group.links.length === 1) {
          const link = group.links[0]!;
          const active = isLinkActive(path, search, link.href, locationHash);
          return (
            <div
              key={link.href}
              className={`flex min-h-10 items-center rounded-lg transition-colors ${active ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[#edf5f8]"}`}
            >
              <Link
                href={link.href}
                className={`block min-w-0 flex-1 px-3 py-2 text-[12px] font-bold uppercase tracking-[0.08em] ${active ? "text-white" : ""}`}
              >
                {group.title}
              </Link>
              {link.createHref ? (
                <Link
                  href={link.createHref}
                  aria-label={`Alta rápida de ${group.title}`}
                  title={`Alta rápida de ${group.title}`}
                  className={`mr-1 inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-lg font-semibold leading-none ${active ? "text-white hover:bg-white/15" : "text-[var(--accent)] hover:bg-white"}`}
                >
                  +
                </Link>
              ) : null}
            </div>
          );
        }
        const groupActive = group.links.some((link) => isLinkActive(path, search, link.href, locationHash));
        const links = group.links.map((link) => {
            const active = isLinkActive(path, search, link.href, locationHash);
            return (
              <div key={link.href} className={`flex min-h-10 items-center rounded-lg transition-colors ${active ? "bg-[var(--accent)] text-white" : "text-[#263b55] hover:bg-[var(--accent-soft)]"}`}>
                <Link href={link.href} className="block min-w-0 flex-1 px-3 py-2 text-[14px] font-medium">
                  {link.label}
                </Link>
                {link.createHref ? (
                  <Link href={link.createHref} aria-label={`Alta rápida de ${link.label}`} title={`Alta rápida de ${link.label}`} className={`mr-1 inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-lg font-semibold leading-none ${active ? "text-white hover:bg-white/15" : "text-[var(--accent)] hover:bg-white"}`}>
                    +
                  </Link>
                ) : null}
              </div>
            );
          });
        if (!group.title) return <div key={`plain-${group.links.map((link) => link.href).join("-")}`} className="space-y-1">{links}</div>;
        return (
          <details key={`${group.title}-${path}`} open={groupActive} className="group rounded-lg">
            <summary className={`flex min-h-10 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-[12px] font-bold uppercase tracking-[0.08em] ${groupActive ? "text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[#edf5f8]"}`}>
              {group.title}
              <span className="text-base transition-transform group-open:rotate-90" aria-hidden>›</span>
            </summary>
            <div className="space-y-1 pb-2 pl-1">{links}</div>
          </details>
        );
      })}
    </nav>
  );
}
