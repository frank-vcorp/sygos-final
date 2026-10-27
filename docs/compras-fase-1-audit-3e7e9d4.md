# Auditoría de Compras Fase 1 en `3e7e9d4`

## Dictamen

**No cumple la Fase 1.** En el commit
`3e7e9d476c0a3730cfb41ff57711862083529f37` existe el módulo de compras
heredado desde octubre 5, pero implementa otro proceso: “compra directa” con
límites presupuestales y una O.C. que pasa a autorización. La única adaptación
visible hacia esta especificación es un menú dedicado del Gerente Operativo
SYSTRON y una ruta de Requerimientos vacía.

Los bloqueos principales son:

1. Requerimientos no tiene modelo, altas, filtros, listado, edición ni conexión
   con OS/DX.
2. No existe Compra `En preparación`, incorporación de solicitudes, edición de
   partidas ni `Confirmar compra`.
3. Compra y O.C. no tienen moneda, fecha de compra, categoría/subcategoría de
   egreso, tipo de pago ni partidas múltiples.
4. Proveedor no tiene moneda, por lo que no puede heredarse a Compra/O.C.
5. El sistema no conecta la cantidad comprada con la entrada completa a
   Inventario.

## Alcance y evidencia de versión

- Se revisó el árbol exacto de `3e7e9d4`, en checkout separado (`detached
  HEAD`), sin modificar el repositorio.
- `origin/codex/ui-visual-refresh` apunta exactamente a `3e7e9d4`; es la única
  rama remota que contiene ese commit.
- El mensaje de `3e7e9d4` es **“Vacaciones: vista del colaborador según
  discovery (solo lectura)”**. Su diff toca Vacaciones, navegación de Técnico y
  Supervisor y etiquetas de vacaciones; no toca Compras, Proveedores, Prisma ni
  permisos de compra.
- La pieza parcial relacionada con esta especificación entró en el padre
  `b4907f8` (**“Menú dedicado para Gerente Operativo SYSTRON”**): añadió
  `src/lib/nav-links-gerente-systron.ts` y la página vacía
  `src/app/(erp)/compras/requerimientos/page.tsx`.
- La implementación funcional que sí existe viene de `df112ce` (**“Abrir
  compras, órdenes y el tablero financiero por empresa”**, octubre 5) y no
  implementa los flujos descritos en la Fase 1.
- Se inspeccionaron los tips remotos disponibles (`main`,
  `codex/ui-visual-refresh`, `design/visual-v2` y
  `cursor/coolify-cloud-agents-cb0e`). No hay evidencia de una implementación
  completa de Compras Fase 1 en otra rama. `main` conserva el módulo legado y
  ni siquiera contiene el menú/página vacía añadidos en `b4907f8`.

## Mapa técnico actual

| Área de la especificación | Implementación real en `3e7e9d4` |
|---|---|
| Menú Compras del Gerente SYSTRON | `src/lib/nav-links-gerente-systron.ts:22-44` |
| Requerimientos | `/compras/requerimientos`; solo encabezado y estado vacío en `src/app/(erp)/compras/requerimientos/page.tsx:6-19` |
| Listado de Compras/O.C. | `/compras`; una página con vistas por `kind/status` en `src/app/(erp)/compras/page.tsx:19-99` |
| Alta actual de compra directa | `/compras/nueva` → `directPurchaseAction` → `registerDirectPurchase`; `src/app/(erp)/compras/nueva/page.tsx`, `src/app/(erp)/compras/actions.ts:24-43`, `src/lib/purchases.ts:41-78` |
| Alta actual de O.C. | `/compras/oc` → `orderAction` → `registerOrder`; `src/app/(erp)/compras/oc/page.tsx`, `src/app/(erp)/compras/actions.ts:46-63`, `src/lib/purchases.ts:80-116` |
| Detalle/acciones de Compra y O.C. | `/compras/[id]`; autorización, procesamiento financiero, ajuste, eliminación y cancelación en `src/app/(erp)/compras/[id]/page.tsx:36-173` |
| Proveedores | `/proveedores`, `/proveedores/nuevo`, `/proveedores/[id]`; acciones en `src/app/(erp)/proveedores/actions.ts` |
| Solicitud técnica desde OS | `PartRequest`, creada desde `/operacion/[id]`; `prisma/schema.prisma:421-443`, `src/lib/technical.ts:513-538` |
| Solicitud técnica desde DX | `PartPresolicitud`, luego promovida a `PartRequest`; `prisma/schema.prisma:446-461`, `src/lib/part-presolicitud.ts:47-147` |
| Modelo de Compra | Un solo `Purchase`, sin renglones; `prisma/schema.prisma:842-868` |
| Modelo de Proveedor | `Supplier`, sin moneda; `prisma/schema.prisma:182-204` |
| Permisos | `purchase.operate`, `purchase.authorize`, `finance.manage` y `supplier.operate`; `src/lib/permissions.ts:87-88,182-190` |

## Hallazgos por sección de la especificación

### 1. Menú Compras

**Coincide**

- Para `GERENTE_OPERATIVO_SYSTRON` aparece el grupo **Compras** con
  Requerimientos, Compras, Órdenes de compra y Proveedores
  (`src/lib/nav-links-gerente-systron.ts:22-44`).

**Discrepancias**

- **[major]** Solo el Gerente SYSTRON recibe ese menú. El rol
  `GERENTE_OPERATIVO_SERVOMOTORES` cae en la navegación genérica y solo ve
  `/compras` y `/proveedores`, sin Requerimientos ni una entrada separada para
  O.C. (`src/lib/nav-links.ts:111-119`).
- **[minor]** Los enlaces “Compras” y “Órdenes de compra” comparten la misma
  ruta base `/compras`. El mecanismo genérico les agrega el mismo acceso rápido
  `+` hacia `/compras/nueva`; por tanto el `+` de O.C. abre una compra directa,
  no `/compras/oc` (`src/app/(erp)/layout.tsx:61-75,80-92`;
  `src/components/side-nav.tsx:79-90`).
- **[major, no invasivo]** `b4907f8` no se limitó a añadir las cuatro entradas
  de Compras: reemplazó toda la navegación del Gerente SYSTRON. Frente a su
  padre eliminó del menú `/reportes`, `/operacion`, `/equipos`, `/motores` y
  `/custodia`, y añadió Vacaciones. Es un cambio de alcance transversal que no
  está pedido por esta Fase 1.

### 2. Requerimientos

**Discrepancias**

- **[blocker]** La página es un placeholder estático. No consulta datos, no
  lista registros y no expone `Nuevo requerimiento`, filtros Estado /
  Solicitante / Fecha ni historial
  (`src/app/(erp)/compras/requerimientos/page.tsx:6-19`).
- **[blocker]** No existe modelo `Requirement`/`Requerimiento`, acciones de
  alta/edición ni relación entre un requerimiento general y una compra. Los
  únicos modelos parecidos son `PartRequest` y `PartPresolicitud`, exclusivos
  de operaciones técnicas (`prisma/schema.prisma:421-461`).
- **[major, roles]** La ruta usa `purchase.operate`, permiso otorgado solo a
  Administrador, CEO, Coordinación y Gerentes. Ventas, Supervisor, Almacén,
  Ayudante General y otros roles no técnicos no pueden entrar, contrario a
  “todos excepto Técnicos” (`src/lib/permissions.ts:182-185`).
- **[blocker]** Las solicitudes de OS/DX no llegan a esta bandeja. La página no
  consulta `PartRequest` ni `PartPresolicitud`, y esos modelos no tienen una
  relación con `Purchase`.
- **[major]** DX conserva relación con el diagnóstico y OS conserva relación con
  su caso, lo cual es correcto como base técnica, pero DX usa estados
  `ACTIVA/PROMOVIDA/ARCHIVADA` y OS usa
  `SOLICITADA/EN_ALMACEN/SURTIDA`; no existen los estados de Requerimiento
  `Pendiente/Atendido/Cancelado`.
- **[major]** El Gerente SYSTRON no puede editar en la UI número de parte,
  descripción o cantidad de estas solicitudes. En DX la edición está
  restringida al Técnico asignado o Supervisor
  (`src/lib/part-presolicitud.ts:30-40,69-88`); en OS el detalle solo ofrece
  recibir/surtir y no existe acción para editar el renglón
  (`src/app/(erp)/operacion/[id]/page.tsx:400-449`).

**Coincide parcialmente**

- Técnicos pueden originar necesidades desde OS; Técnico/Supervisor pueden
  crear presolicitudes desde DX. Se conservan número de parte, descripción,
  cantidad y la relación con el caso técnico
  (`src/app/(erp)/operacion/[id]/page.tsx:324-449`).

### 3. Vista Compras

**Discrepancias**

- **[blocker]** Solo hay un botón de cabecera `Nueva compra`; no hay dos botones
  independientes `Nueva compra` y `Registrar compra`
  (`src/app/(erp)/compras/page.tsx:53-55`).
- **[major]** Los filtros son “vista” y búsqueda libre por folio/proveedor. No
  existen Estado, Fecha ni Categoría
  (`src/app/(erp)/compras/page.tsx:56-68`).
- **[major]** La página mezcla Compras, O.C., “Por procesar” y “Por autorizar”.
  Incluye estados y operaciones administrativas posteriores que no forman parte
  de la vista pedida para el Gerente
  (`src/app/(erp)/compras/page.tsx:24-50`).

### 4. Nueva compra

- **[blocker]** No existe el concepto `En preparación`. `/compras/nueva` se
  titula **Compra directa**, dice que consume presupuesto y al guardar crea
  inmediatamente `PENDIENTE_VALIDAR`
  (`src/app/(erp)/compras/nueva/page.tsx:14-29`;
  `src/lib/purchases.ts:52-67`).
- **[major]** Se añadió una regla ajena a la Fase 1: límite individual y
  presupuesto mensual por usuario. Si la compra los rebasa, se rechaza y se
  obliga a solicitar O.C. (`src/lib/purchases.ts:10-50`;
  `src/lib/roles.ts:60-65`).
- **[blocker]** No se puede mantener abierta una compra, volver a ella ni ir
  agregando componentes.

### 5. Formulario base y moneda

- **[blocker]** `Purchase` solo almacena proveedor, concepto único, cantidad
  única, importe, destino/referencia y solicitante. Faltan moneda, categoría,
  subcategoría, tipo de pago, fecha de compra y partidas relacionadas
  (`prisma/schema.prisma:842-868`).
- **[blocker]** No existe `PurchaseLine` ni equivalente; concepto/cantidad son
  columnas del encabezado, por lo que una compra no puede tener varias
  partidas.
- **[blocker]** `Supplier` no tiene moneda y los formularios de alta/edición de
  proveedor tampoco la capturan (`prisma/schema.prisma:182-204`;
  `src/app/(erp)/proveedores/nuevo/page.tsx:12-27`).
- **[major]** La presentación monetaria está fijada globalmente a MXN; incluso
  una eventual compra de proveedor USD se mostraría como MXN
  (`src/lib/money.ts:35-37`).

### 6. Categoría y subcategoría

- **[blocker]** Compra/O.C. no tienen campos ni controles de categoría o
  subcategoría.
- **[blocker]** En este commit no existe el “catálogo de egresos” que la
  especificación da por existente. Los modelos de catálogo son para equipo
  (`CatalogType`, `CatalogBrand`, `CatalogModel`) y agenda; Finanzas conserva
  `FinanceMovement.category` como texto libre y el formulario manual usa un
  `<input>` (`prisma/schema.prisma:252-279,822-839`;
  `src/app/(erp)/finanzas/page.tsx:264-280`). Esto es además una dependencia de
  producto/datos que debe aclararse antes de implementar sin crear un catálogo
  paralelo.

### 7. Tipo de pago

- **[major]** El Gerente no captura tipo de pago en Compra/O.C. El único dato
  cercano es `settlement = CONTADO | CREDITO`, elegido después por quien tenga
  `finance.manage` al **procesar** la compra
  (`src/app/(erp)/compras/[id]/page.tsx:117-135`;
  `src/lib/permissions.ts:188-190`). El Gerente no tiene ese permiso.
- **[major]** Ese procesamiento crea inmediatamente egreso o cuenta por pagar
  (`src/lib/purchases.ts:236-279`), es decir, ejecuta un flujo financiero
  posterior en lugar de solo preparar los datos de Fase 1.

### 8–11. Agregar solicitudes, cantidad y edición de partidas

- **[blocker]** No hay selector/bandeja de pendientes de OS, DX o
  Requerimientos ni acción `+ Agregar`.
- **[blocker]** No hay relación entre `Purchase` y `PartRequest` /
  `PartPresolicitud`; `destinationRef` es texto libre, no una llave.
- **[blocker]** No existe cantidad sugerida por solicitud ni una cantidad de
  compra separada y editable.
- **[blocker]** No se puede modificar número de parte, descripción o cantidad
  desde Compra.
- **[blocker]** Tampoco se puede agregar una partida directa adicional; el
  formulario completo representa una sola partida/concepto.
- **[major]** La única relación con OS/DX se captura manualmente mediante
  `Destino` y `Referencia de destino`, reescribiendo datos en lugar de
  reutilizar la solicitud (`src/app/(erp)/compras/nueva/page.tsx:29-40`).

### 12. Relación con Inventario

- **[blocker]** Confirmar/procesar una Compra no crea entrada de Inventario. El
  stock solo aumenta mediante recepción de un `PartRequest` u otras acciones
  independientes de Inventario (`src/lib/technical.ts:540-583`).
- **[major]** La recepción de una solicitud prohíbe recibir más que
  `qtyRequested` (`src/lib/technical.ts:543-548`). Por tanto el ejemplo de
  comprar/recibir 10 a partir de una solicitud de 3 no cabe en este flujo.
- **[major]** Compra sí pide decidir un `Destino` completo (`GASTO`,
  `INVENTARIO`, `OS`, `MOT`) y una referencia. Esto acopla la compra al destino
  operativo y, para MOT a crédito, incluso copia la referencia a una cuenta por
  pagar (`src/lib/purchases.ts:256-263`), contrario a dejar que Almacén surta
  después.

### 13. Confirmar compra

- **[blocker]** No existe botón ni acción `Confirmar compra`.
- **[blocker]** No existe transición `EN_PREPARACION → PENDIENTE_VALIDACION`.
  La compra directa nace en `PENDIENTE_VALIDAR`
  (`src/lib/purchases.ts:52-67`).
- **[blocker]** Tampoco pueden validarse los campos obligatorios de la
  especificación porque no están en el modelo.

### 14. Registrar compra

**Coincide parcialmente**

- El único alta de compra directa termina en “Pendiente de validar” sin crear un
  Requerimiento retrospectivo.

**Discrepancias**

- **[blocker]** No existe un botón/ruta diferenciada `Registrar compra`; la misma
  ruta abierta por `Nueva compra` muestra al final un botón **Registrar compra**
  (`src/app/(erp)/compras/nueva/page.tsx:14-44`).
- **[blocker]** El formulario no contiene los datos base requeridos ni partidas.
- **[major]** La compra directa se condiciona a límites/presupuesto no definidos
  en esta Fase.

### 15. Órdenes de Compra

**Coincide parcialmente**

- Existe alta de O.C. y, para el Gerente, el guardado produce
  `PENDIENTE_AUTORIZACION`, es decir, la envía al flujo existente
  (`src/lib/purchases.ts:89-113`).

**Discrepancias**

- **[major]** El acceso se presenta como enlace de texto “Nueva orden de compra”,
  no botón `Nueva O.C.` (`src/app/(erp)/compras/page.tsx:69`).
- **[major]** La vista O.C. muestra todas las no eliminadas; no inicia en
  pendientes y no ofrece filtros Estado/Fecha
  (`src/app/(erp)/compras/page.tsx:24-42,56-68`).
- **[blocker]** El formulario tiene proveedor opcional, concepto, cantidad,
  importe estimado, destino y referencia. Faltan moneda heredada, categoría,
  subcategoría, tipo de pago, fecha y partidas
  (`src/app/(erp)/compras/oc/page.tsx:14-44`).
- **[major]** Si CEO o Administrador crean la O.C., nace `AUTORIZADA`; además el
  detalle conserva autorizar/rechazar, cambios post-autorización, cancelar y
  procesar. Son comportamientos de fases posteriores ya existentes
  (`src/lib/purchases.ts:89-113,118-218`;
  `src/app/(erp)/compras/[id]/page.tsx:53-76,117-171`).

### 16. Proveedores

**Coincide**

- Se mantienen listado, búsqueda, detalle y botón `Nuevo proveedor`
  (`src/app/(erp)/proveedores/page.tsx:8-68`).
- Proveedor se limita por empresa y se puede seleccionar en Compra/O.C.

**Discrepancias**

- **[blocker]** Falta moneda MXN/USD en modelo, altas, edición y listado.
- **[minor]** El listado añade un filtro Activos/Inactivos, no mencionado en la
  especificación. Es funcionalidad previa y no resulta dañina por sí sola.

### 17. Estados

- **[blocker] Requerimientos:** no existen
  `PENDIENTE/ATENDIDO/CANCELADO`; los dos modelos técnicos usan otros estados.
- **[blocker] Compra:** no existe `EN_PREPARACION`. Sí existe el equivalente
  semántico `PENDIENTE_VALIDAR`, pero convive con
  `PENDIENTE_AUTORIZACION/AUTORIZADA/RECHAZADA/PROCESADA/CANCELADA/ELIMINADA`
  (`src/app/(erp)/compras/page.tsx:9-16`).
- **[match parcial] O.C.:** conserva estados para autorización, aunque su
  formulario está incompleto.

### 18. Los dos flujos de Compra

- **[blocker] Planeada:** ausente por completo.
- **[match parcial] Ya realizada:** existe conceptualmente como compra directa
  que nace pendiente de validar, pero está mezclada con el botón `Nueva compra`,
  usa un formulario incompleto y aplica límites mensuales no especificados.

### 19. Restricción de Fase 1 y “no invasivo”

- **[major]** El módulo legado expone y ejecuta validación/autorización del CEO,
  procesamiento de Coordinación, egreso, cuenta por pagar, corrección de importe
  y cancelación. No fueron añadidos por `3e7e9d4`, pero la experiencia actual no
  separa claramente Fase 1 de los flujos posteriores.
- **[major]** El único cambio parcialmente atribuible a la Fase 1 (`b4907f8`)
  alteró toda la navegación del Gerente SYSTRON y retiró módulos no relacionados
  con Compras. Esto contradice el criterio “no cambiar menús, paneles o patrones”
  si se evalúa contra el padre inmediato.
- **[minor]** No se reconstruyeron visualmente páginas de Compras; se reutilizan
  componentes compartidos. La falta principal no es visual sino funcional y de
  datos.

## Qué sí coincide, en breve

- Menú Compras con las cuatro entradas pedidas para el Gerente SYSTRON.
- Sección de Proveedores con listado, búsqueda y alta.
- Selección de proveedor y captura de importe en Compra/O.C.
- Solicitante, empresa y fecha de creación se conservan automáticamente en el
  módulo legado.
- OS y DX conservan su relación técnica al generar solicitudes de refacciones.
- El Gerente tiene `purchase.operate` y `supplier.operate`.
- Una compra directa queda pendiente de validación al registrarse.
- Una O.C. del Gerente se envía pendiente de autorización.

## Prioridad de corrección sugerida

1. **Bloqueadores de datos:** definir Requerimiento, renglones de Compra,
   relaciones con OS/DX, moneda de Proveedor y los campos financieros base;
   aclarar dónde están los supuestos catálogos de egreso.
2. **Bloqueadores de flujo:** separar Compra planeada de Compra ya realizada,
   implementar `En preparación`, agregar solicitudes/partidas y confirmar.
3. **Roles y vistas:** habilitar altas de Requerimiento para todos excepto
   Técnicos, y corregir filtros/vistas iniciales.
4. **Inventario:** registrar toda la cantidad realmente adquirida como entrada,
   sin asignarla desde Compra a OS/DX.
5. **No invasividad:** preservar el menú/panel vigente acordado y aislar cambios
   a Compras; revisar expresamente las rutas retiradas por `b4907f8`.

