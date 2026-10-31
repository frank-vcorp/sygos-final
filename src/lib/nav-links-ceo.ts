import type { NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const showCeo = (role: Role) => role === "CEO";

/** Menú lateral del CEO (solo navegación). */
export const CEO_NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Inicio",
    direct: true,
    links: [{ href: "/panel", show: showCeo }],
  },
  {
    title: "Servicios",
    links: [
      { href: "/servicios/activos", label: "Activos", show: (role, code) => showCeo(role) && can(role, "attention.catalog", code) },
      { href: "/servicios/historial", label: "Historial", show: (role, code) => showCeo(role) && can(role, "attention.catalog", code) },
    ],
  },
  {
    title: "Personal",
    links: [
      { href: "/nomina", label: "Nómina", show: showCeo },
      { href: "/personal", label: "Colaboradores", show: showCeo },
    ],
  },
  {
    title: "Administración",
    links: [
      { href: "/facturacion", label: "Facturación", show: showCeo },
      { href: "/compras", label: "Compras", show: showCeo },
      { href: "/compras?vista=oc", label: "Órdenes de compra", show: showCeo },
      { href: "/proveedores", label: "Proveedores", show: showCeo },
    ],
  },
  {
    title: "Comercial",
    links: [
      { href: "/prospectos", label: "Prospectos", show: showCeo },
      { href: "/clientes", label: "Clientes", show: showCeo },
      { href: "/equipos", label: "Equipos", show: showCeo },
      { href: "/cotizaciones", label: "Cotizaciones", show: showCeo },
      { href: "/ventas", label: "Venta de equipos", show: showCeo },
    ],
  },
  {
    title: "Configuración",
    links: [],
    sections: [
      {
        title: "Finanzas",
        links: [
          { href: "/configuracion/cuentas", label: "Cuentas", show: showCeo },
          { href: "/configuracion/catalogos-financieros", label: "Catálogos financieros", show: showCeo },
        ],
      },
      {
        title: "Comercial",
        links: [
          { href: "/configuracion/actividades", label: "Actividades comerciales", show: showCeo },
          { href: "/configuracion/metas", label: "Metas", show: showCeo },
        ],
      },
      {
        title: "Operación técnica",
        links: [
          { href: "/configuracion/prioridades/diagnostico", label: "Prioridades de diagnóstico", show: showCeo },
          { href: "/configuracion/prioridades/reparacion", label: "Prioridades de reparación / OS", show: showCeo },
        ],
      },
      {
        title: "Compras",
        links: [
          { href: "/configuracion/presupuestos", label: "Presupuestos", show: showCeo },
        ],
      },
      {
        title: "Usuarios",
        links: [
          { href: "/usuarios", label: "Usuarios", show: showCeo },
        ],
      },
    ],
  },
];
