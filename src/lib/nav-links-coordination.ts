import type { NavGroupDef } from "@/lib/nav-links";
import { requerimientosNavGroup } from "@/lib/nav-links";
import type { Role } from "@/lib/roles";

const showCoord = (role: Role) => role === "COORDINACION_ADMINISTRACION";

/** Menú lateral de Coordinación de Administración (SYSTRON y Servomotores). */
export const COORDINATION_NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Inicio",
    direct: true,
    links: [{ href: "/panel?vista=pendientes", show: showCoord }],
  },
  {
    title: "Finanzas",
    links: [
      { href: "/finanzas?vista=ingresos", label: "Ingresos", show: showCoord },
      { href: "/finanzas?vista=egresos", label: "Egresos", show: showCoord },
      { href: "/cobranza?vista=cxc", label: "Cuentas por cobrar", show: showCoord },
      { href: "/finanzas?vista=cxp", label: "Cuentas por pagar", show: showCoord },
      { href: "/pagos", label: "Pagos", show: showCoord },
      { href: "/cobranza", label: "Cobranza", show: showCoord },
      { href: "/finanzas?vista=movimientos", label: "Movimientos", show: showCoord },
    ],
  },
  {
    title: "Personal",
    links: [
      { href: "/nomina", label: "Nómina", show: showCoord },
      { href: "/personal", label: "Colaboradores", show: showCoord },
      { href: "/personal/asistencia", label: "Asistencia", show: showCoord },
      { href: "/personal/asistencia?vista=vacaciones", label: "Vacaciones", show: showCoord },
      { href: "/personal/horas", label: "Tiempo extra", show: showCoord },
    ],
  },
  {
    title: "Administración",
    links: [
      { href: "/facturacion", label: "Facturación", show: showCoord },
      { href: "/compras", label: "Compras", show: showCoord },
      { href: "/compras?vista=oc", label: "Órdenes de compra", show: showCoord },
      { href: "/proveedores", label: "Proveedores", show: showCoord },
    ],
  },
  {
    title: "Comercial",
    links: [
      { href: "/prospectos", label: "Prospectos", show: showCoord },
      { href: "/clientes", label: "Clientes", show: showCoord },
      { href: "/equipos", label: "Equipos", show: showCoord },
      { href: "/cotizaciones", label: "Cotizaciones", show: showCoord },
      { href: "/ventas", label: "Venta de equipos", show: showCoord },
    ],
  },
  requerimientosNavGroup(),
];
