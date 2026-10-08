import type { NavGroupDef } from "@/lib/nav-links";
import type { Role } from "@/lib/roles";

const showCoord = (role: Role) => role === "COORDINACION_ADMINISTRACION";

/** Menú lateral de Coordinación de Administración (solo navegación; permisos sin cambio). */
export const COORDINATION_NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Inicio",
    links: [
      { href: "/panel?vista=pendientes", label: "Pendientes administrativos", show: showCoord },
      { href: "/cobranza?vista=vencidas", label: "Alertas de vencimientos", show: showCoord },
    ],
  },
  {
    title: "Comercial",
    links: [
      { href: "/clientes", label: "Clientes", show: showCoord },
      { href: "/cotizaciones", label: "Cotizaciones", show: showCoord },
      { href: "/ventas", label: "Ventas de equipo", show: showCoord },
      { href: "/prospectos", label: "Prospectos", show: showCoord },
    ],
  },
  {
    title: "Facturación y cobranza",
    links: [
      { href: "/facturacion?vista=solicitudes", label: "Solicitudes pendientes", show: showCoord },
      { href: "/facturacion?vista=facturas", label: "Facturas", show: showCoord },
      { href: "/facturacion/nuevo", label: "Factura libre", show: showCoord },
      { href: "/facturacion?vista=canceladas", label: "Cancelaciones y notas", show: showCoord },
      { href: "/facturacion?vista=remisiones", label: "Remisiones", show: showCoord },
      { href: "/pagos?vista=pendientes", label: "Pagos por validar", show: showCoord },
      { href: "/pagos?vista=validados", label: "Pagos validados", show: showCoord },
      { href: "/cobranza?vista=cxc", label: "Cuentas por cobrar", show: showCoord },
      { href: "/cobranza", label: "Cobranza", show: showCoord },
    ],
  },
  {
    title: "Compras y proveedores",
    links: [
      { href: "/compras?vista=directas", label: "Compras directas", show: showCoord },
      { href: "/compras?vista=oc", label: "Órdenes de compra", show: showCoord },
      { href: "/compras?vista=procesar", label: "O.C. autorizadas por procesar", show: showCoord },
      { href: "/proveedores", label: "Proveedores", show: showCoord },
    ],
  },
  {
    title: "Finanzas",
    links: [
      { href: "/finanzas", label: "Dashboard financiero", show: showCoord },
      { href: "/finanzas?vista=movimientos", label: "Movimientos", show: showCoord },
      { href: "/finanzas?vista=ingresos", label: "Ingresos", show: showCoord },
      { href: "/finanzas?vista=egresos", label: "Egresos", show: showCoord },
      { href: "/finanzas?vista=transferencias", label: "Transferencias", show: showCoord },
      { href: "/finanzas?vista=cuentas", label: "Cuentas y bancos", show: showCoord },
      { href: "/finanzas?vista=cxp", label: "Cuentas por pagar", show: showCoord },
    ],
  },
  {
    title: "Personal",
    links: [
      { href: "/personal", label: "Colaboradores", show: showCoord },
      { href: "/personal/asistencia", label: "Asistencia", show: showCoord },
      { href: "/personal/asistencia?vista=vacaciones", label: "Vacaciones", show: showCoord },
      { href: "/personal?vista=documentos", label: "Documentos laborales", show: showCoord },
      { href: "/comisiones", label: "Bonos e incidencias", show: showCoord },
    ],
  },
  {
    title: "Nómina",
    links: [
      { href: "/nomina", label: "Nóminas", show: showCoord },
      { href: "/nomina?vista=actual", label: "Periodo actual", show: showCoord },
      { href: "/nomina?vista=incidencias", label: "Incidencias y faltantes", show: showCoord },
      { href: "/nomina?vista=documentos", label: "Documentos de nómina", show: showCoord },
      { href: "/nomina?vista=extraordinarios", label: "Ajustes extraordinarios", show: showCoord },
      { href: "/nomina?vista=aguinaldo", label: "Aguinaldo", show: showCoord },
      { href: "/comisiones", label: "Comisiones", show: showCoord },
    ],
  },
  {
    title: "Reportes",
    links: [
      { href: "/reportes/movimientos", label: "Financieros", show: showCoord },
      { href: "/reportes/cxp", label: "Cuentas por pagar", show: showCoord },
      { href: "/reportes/cxc", label: "Cobranza", show: showCoord },
      { href: "/facturacion?vista=facturas", label: "Facturación", show: showCoord },
      { href: "/compras?vista=directas", label: "Compras", show: showCoord },
      { href: "/reportes/nomina", label: "Personal y nómina", show: showCoord },
    ],
  },
];
