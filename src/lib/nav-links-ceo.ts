import type { NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const showCeo = (role: Role) => role === "CEO";

/** Menú lateral del CEO (solo navegación). */
export const CEO_NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Inicio",
    links: [
      { href: "/panel?vista=autorizacion", label: "Pendientes de autorización", show: showCeo },
      { href: "/panel?vista=comercial", label: "Pendientes comerciales", show: showCeo },
      { href: "/panel?vista=tecnico", label: "Pendientes técnicos", show: showCeo },
      { href: "/panel?vista=admin", label: "Pendientes administrativos", show: showCeo },
      { href: "/panel?vista=finanzas", label: "Indicadores financieros", show: showCeo },
    ],
  },
  {
    title: "Comercial",
    links: [
      { href: "/clientes", label: "Clientes", show: showCeo },
      { href: "/prospectos", label: "Prospectos", show: showCeo },
      { href: "/cotizaciones", label: "Cotizaciones", show: showCeo },
      { href: "/cotizaciones?vista=pendientes", label: "Pendientes de cotizar", show: showCeo },
      { href: "/ventas", label: "Ventas de equipo", show: showCeo },
      { href: "/agenda", label: "Agenda comercial", show: showCeo },
      { href: "/agenda#metas", label: "Metas comerciales", show: (role, code) => showCeo(role) && can(role, "goals.manage", code) },
      { href: "/produccion", label: "Producción comercial", show: showCeo },
      { href: "/reportes/conversion", label: "Desempeño comercial", show: showCeo },
    ],
  },
  {
    title: "Operación técnica",
    links: [
      { href: "/equipos", label: "Equipos (EQUI)", show: (role, code) => showCeo(role) && code === "SYSTRON" && can(role, "equipment.catalog", code) },
      { href: "/motores", label: "Motores (MOT)", show: (role, code) => showCeo(role) && can(role, "mot.view", code) },
      { href: "/operacion?vista=validacion", label: "Diagnósticos por validar", show: showCeo },
      { href: "/operacion?vista=activas", label: "Órdenes y reparaciones", show: showCeo },
      { href: "/servicios/garantia", label: "Garantías", show: showCeo },
      { href: "/produccion", label: "Producción técnica", show: showCeo },
      { href: "/custodia", label: "Custodia física", show: showCeo },
      { href: "/inventario", label: "Refacciones e inventario", show: (role, code) => showCeo(role) && can(role, "inventory.operate", code) },
      { href: "/operacion", label: "Cola de operación", show: showCeo },
    ],
  },
  {
    title: "Compras y proveedores",
    links: [
      { href: "/compras?vista=directas", label: "Compras directas", show: showCeo },
      { href: "/compras?vista=oc", label: "Órdenes de compra", show: showCeo },
      { href: "/compras?vista=autorizar", label: "O.C. por autorizar", show: showCeo },
      { href: "/compras?vista=procesar", label: "O.C. por procesar", show: showCeo },
      { href: "/proveedores", label: "Proveedores", show: showCeo },
    ],
  },
  {
    title: "Facturación y cobranza",
    links: [
      { href: "/facturacion?vista=solicitudes", label: "Solicitudes de factura", show: showCeo },
      { href: "/facturacion?vista=facturas", label: "Facturas", show: showCeo },
      { href: "/facturacion?vista=remisiones", label: "Remisiones", show: showCeo },
      { href: "/facturacion?vista=canceladas", label: "Cancelaciones y notas", show: showCeo },
      { href: "/pagos?vista=pendientes", label: "Pagos por validar", show: showCeo },
      { href: "/pagos?vista=validados", label: "Pagos validados", show: showCeo },
      { href: "/cobranza?vista=cxc", label: "Cuentas por cobrar", show: showCeo },
      { href: "/cobranza?vista=vencidas", label: "Cobranza vencida", show: showCeo },
      { href: "/cobranza", label: "Cobranza", show: showCeo },
    ],
  },
  {
    title: "Finanzas",
    links: [
      { href: "/finanzas", label: "Dashboard financiero", show: showCeo },
      { href: "/finanzas?vista=movimientos", label: "Movimientos", show: showCeo },
      { href: "/finanzas?vista=ingresos", label: "Ingresos", show: showCeo },
      { href: "/finanzas?vista=egresos", label: "Egresos", show: showCeo },
      { href: "/finanzas?vista=cuentas", label: "Cuentas, bancos y efectivo", show: showCeo },
      { href: "/finanzas?vista=transferencias", label: "Transferencias", show: showCeo },
      { href: "/finanzas?vista=cxp", label: "Cuentas por pagar", show: showCeo },
    ],
  },
  {
    title: "Personal",
    links: [
      { href: "/personal", label: "Colaboradores", show: showCeo },
      { href: "/personal/asistencia", label: "Asistencia", show: showCeo },
      { href: "/personal/asistencia?vista=vacaciones", label: "Vacaciones", show: showCeo },
      { href: "/personal/horas", label: "Horas extra", show: showCeo },
      { href: "/personal?vista=documentos", label: "Documentos laborales", show: showCeo },
    ],
  },
  {
    title: "Nómina",
    links: [
      { href: "/nomina", label: "Nóminas", show: showCeo },
      { href: "/nomina?vista=actual", label: "Periodo actual", show: showCeo },
      { href: "/nomina?vista=extraordinarios", label: "Ajustes extraordinarios", show: showCeo },
      { href: "/nomina?vista=aguinaldo", label: "Aguinaldo", show: showCeo },
      { href: "/comisiones", label: "Bonos y comisiones", show: showCeo },
      { href: "/nomina?vista=documentos", label: "Documentos de nómina", show: showCeo },
    ],
  },
  {
    title: "Reportes",
    links: [
      { href: "/reportes/cotizaciones", label: "Comerciales", show: showCeo },
      { href: "/reportes/conversion", label: "Conversión comercial", show: showCeo },
      { href: "/reportes/diagnosticos", label: "Técnicos · diagnósticos", show: showCeo },
      { href: "/reportes/reparaciones", label: "Técnicos · reparaciones", show: showCeo },
      { href: "/reportes/inventario", label: "Técnicos · inventario", show: showCeo },
      { href: "/reportes/movimientos", label: "Financieros", show: showCeo },
      { href: "/reportes/cxp", label: "Cuentas por pagar", show: showCeo },
      { href: "/compras?vista=directas", label: "Compras", show: showCeo },
      { href: "/reportes/cxc", label: "Cobranza", show: showCeo },
      { href: "/reportes/nomina", label: "Personal y nómina", show: showCeo },
    ],
  },
  {
    title: "Configuración",
    links: [
      { href: "/configuracion#identidad", label: "Configuración general", show: showCeo },
      { href: "/configuracion#prioridades", label: "Prioridades y SLA", show: showCeo },
      { href: "/usuarios", label: "Usuarios", show: showCeo },
    ],
  },
];
