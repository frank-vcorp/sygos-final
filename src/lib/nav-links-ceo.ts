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
    title: "Finanzas",
    links: [
      { href: "/finanzas?vista=movimientos", label: "Movimientos", show: showCeo },
      { href: "/finanzas?vista=ingresos", label: "Ingresos", show: showCeo },
      { href: "/finanzas?vista=egresos", label: "Egresos", show: showCeo },
      { href: "/finanzas?vista=cuentas", label: "Cuentas", show: showCeo },
      { href: "/finanzas?vista=transferencias", label: "Transferencias", show: showCeo },
      { href: "/finanzas?vista=cxp", label: "CxP", show: showCeo },
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
      { href: "/servicio-campo", label: "Servicio de campo", show: (role, code) => showCeo(role) && code === "SYSTRON" },
    ],
  },
  {
    title: "Configuración",
    links: [
      { href: "/configuracion", label: "Configuración", show: showCeo },
      { href: "/usuarios", label: "Usuarios", show: showCeo },
    ],
  },
];
