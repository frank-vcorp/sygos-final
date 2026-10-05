# SYGOS 3.0 — DISCOVERY FUNCIONAL

---

**Proyecto:** SYGOS 3.0  
**Empresas:** SYSTRON / Servomotores  
**Zona horaria:** America/Mexico_City  

**Fuente de verdad:** este documento es la funete de verdad de un podroducto, contiene todo lo que ncesita el agente de cursor para la contruccion, no son pantallas ni detalels separados.  
Son capa de datos + pantallas + APIs: tablas, formularios, listados, permisos gruesos y un menú más alineado al discovery. Eso no es el producto terminado según el documento.

Ademas contiene cada módulo del discovery y su recorrido operativo cerrado,

Bandejas dentro del módulo (p. ej. “Pendientes de cotizar” dentro de Cotizaciones), con el rol dueño claro en cada estado.
Detalle por estado y rol: solo acciones válidas; mensaje explícito de qué falta para avanzar; sin mezclar bloques que confunden (precio vs destinatarios vs decisión).
Handoffs: al resolver un paso, el trabajo aparece donde toca (CEO, vendedor, almacén, coordinación…) y desaparece de la bandeja anterior cuando corresponde.
Relaciones navegables en detalle (cliente ↔ EQUI/MOT ↔ atención ↔ diagnóstico ↔ OS ↔ cotización ↔ venta ↔ factura ↔ cobranza), respetando empresa activa e intercompañía (p. ej. base SM oculta al vendedor).
Reglas de negocio congeladas donde el discovery las marca: crédito al autorizar, incremento en reparación, autorización parcial en venta de equipo, “autorizada pendiente de ingreso” sin OS prematura, MOT intercompañía en cadena, etc.
Origen automático de pendientes (diagnóstico validado, reparación terminada, garantía no procedente, MOT base SM…) sin re-capturar lo que ya existe.

---

## Convención de lectura

- **Área:** agrupación documental de módulos relacionados. No implica una pantalla.
- **Módulo:** capacidad funcional real que el usuario opera.
- **Entidad:** objeto de negocio con identidad propia.
- **Vista/Bandeja/Panel:** forma de consultar u operar entidades existentes.
- **Regla transversal:** comportamiento que aplica en varios módulos.

Una entidad relevante no se considera terminada porque tenga una tabla o formulario. Debe poder **nacer, encontrarse, abrirse, operarse, navegar sus relaciones, cambiar de estado y conservar la historia necesaria**.

---

## 1. Definición general del producto

---

### 1.1 Objetivo

---

SYGOS 3.0 será el ERP operativo multiempresa de **SYSTRON** y **Servomotores (SYSTRON Servomotores)** para unificar en un solo producto la operación comercial, técnica, física, administrativa, fiscal, financiera y de personal, preservando la independencia legal y administrativa de cada empresa.

El sistema debe sustituir la fragmentación actual entre herramientas y recapturas, manteniendo trazabilidad navegable entre los recorridos relevantes:

- SYSTRON: Cliente -> Equipo/EQUI -> Atención -> Diagnóstico/Reparación -> Cotización -> OS -> Almacén -> Facturación/Remisión -> Pago/Cobranza -> Finanzas.
- Servomotores directo: Cliente -> MOT -> Ingreso -> Diagnóstico/Reparación -> Cotización -> Egreso -> Facturación/Remisión -> Pago/Cobranza -> Finanzas.
- Intercompañía: Cliente final SYSTRON -> MOT -> operación técnica Servomotores -> Cotización Servomotores a SYSTRON -> Cotización SYSTRON al cliente final -> Facturación intercompañía -> CxC Servomotores / CxP SYSTRON -> pago real.

También cubre Venta de equipo, Servicio en campo, Garantías, Servicio Externo/Maquila, Compras y Órdenes de Compra, Inventario, Cuentas por Pagar, Personal, Nómina, Asistencia, Comisiones, Producción Técnica, Paneles y Reportes.

Este Discovery define **qué debe hacer SYGOS 3.0**. La implementación interna queda abierta a Cursor.

---

---

### 1.2 Principios funcionales

---

1. El sistema inicia sin datos demo ni registros ficticios.
2. SYSTRON y Servomotores operan como empresas independientes dentro del mismo producto.
3. CEO, Coordinación de Administración y Administrador pueden cambiar de empresa; nunca se mezclan operaciones ni cifras de ambas empresas en una misma vista consolidada.
4. El contexto de empresa activo debe ser siempre evidente antes de registrar una operación.
5. Los usuarios operativos normales pertenecen a una sola empresa.
6. Las relaciones relevantes deben ser navegables.
7. La trazabilidad prevalece sobre CRUD genérico.
8. Los registros operativos principales se cancelan/inactivan cuando corresponda; no se eliminan si eso destruye historia.
9. Los documentos históricos conservan la información con la que fueron generados.
10. La información financiera y comercial se restringe según rol y empresa.
11. Los procesos técnicos conservan antecedentes, autores, fechas y cambios relevantes.
12. Las integraciones no simulan éxito en producción.
13. Existe búsqueda global discreta únicamente para CEO y Administrador, respetando empresa activa y permisos.
14. No existe gestor documental general; cada archivo se consulta desde su entidad de origen.
15. No existe centro global de notificaciones.
16. No existe auditoría universal de cada campo; se mantienen los historiales funcionales definidos.
17. Los importes comerciales actuales se manejan en MXN, salvo referencias de proveedor que posteriormente deban validarse en MXN.
18. El sistema debe ser responsivo en escritorio, tablet y móvil y contemplar PWA instalable cuando sea razonable, sin asumir trabajo offline.

---

---

### 1.3 Alcance

---

#### Alcance actual

Incluye:

- Operación multiempresa SYSTRON / Servomotores con contexto activo separado.
- Usuarios y roles fijos.
- Configuración general y por empresa.
- Clientes, Prospectos y Proveedores independientes por empresa.
- Equipos `EQUI` de SYSTRON.
- Motores/servomotores `MOT` con identidad global compartida.
- Diagnóstico.
- Reparación preautorizada.
- Diagnóstico de Garantía.
- Órdenes de Servicio.
- Servicio Externo/Maquila de SYSTRON.
- Bitácora Técnica.
- Cotizaciones y flujo unificado `Pendiente de cotizar`.
- Venta de equipo.
- Servicio en campo.
- Almacén SYSTRON.
- Ingresos, resguardo y egresos de Servomotores.
- Salida a prueba.
- Inventario de refacciones de SYSTRON con mínimos/máximos informativos.
- Inventario propio de Servomotores, inicialmente deshabilitado y habilitable por Administrador.
- Compras directas.
- Órdenes de Compra internas.
- Facturación y Remisiones.
- Factura libre.
- Facturación intercompañía Servomotores -> SYSTRON.
- Pagos.
- Cuentas por cobrar y Cobranza.
- Cuentas por pagar.
- Finanzas completas e independientes por empresa.
- Personal/RRHH independiente por empresa.
- Asistencia por kiosco para personal aplicable.
- Vacaciones y prima vacacional automática.
- Nómina semanal.
- Horas extra.
- Bonos, Aguinaldo y Comisiones cuando apliquen.
- Producción Técnica.
- Panel de Ventas.
- Paneles Técnicos.
- Panel del CEO.
- Panel de Coordinación de Administración.
- Reportes.
- Búsqueda global restringida.
- Modo de Pruebas temporal y aislado.

#### Futuro

Se consideran para evolución futura, pero no se incluyen ahora:

- Metas formales de Producción Técnica.
- Multimoneda operativa completa.
- Importación automática de estados de cuenta.
- Recordatorios/notificaciones externas adicionales.
- Transferencias de inventario entre SYSTRON y Servomotores.
- Nuevos reportes conforme se detecten necesidades reales.
- Nuevos roles o matriz de permisos configurable.
- IA únicamente si aparece un caso de valor funcional real.

#### Fuera de alcance actual

No incluye:

- CRM avanzado.
- Planeación de rutas.
- Programación formal de servicio en campo.
- Reporte técnico estructurado obligatorio para servicio en campo.
- Reclutamiento.
- Capacitación.
- Evaluaciones de desempeño de RRHH.
- Incapacidades médicas.
- Finiquitos.
- Costeo de inventario.
- Ubicaciones internas de almacén.
- Reservas de inventario.
- Constructor libre de reportes.
- Centro global de notificaciones.
- Gestor documental general.
- Dashboards o estados financieros consolidados de ambas empresas.
- Inventario compartido entre empresas.
- Trabajo offline.
- Datos demo en producción.

---

---

### 1.4 Empresas, usuarios y roles

---

Los roles son fijos. No existe editor de roles ni constructor de permisos.

#### Contexto de empresa

Existen dos empresas operativas:

- `SYSTRON`.
- `Servomotores`.

CEO, Coordinación de Administración y Administrador pueden trabajar en ambas y deben seleccionar/cambiar explícitamente la empresa activa. Todas las vistas, paneles, búsquedas, finanzas, clientes, proveedores, personal, reportes y documentos se restringen a la empresa activa, salvo relaciones intercompañía expresamente definidas.

No existe vista consolidada de ambas empresas.

Los usuarios operativos normales pertenecen a una empresa y un rol.

#### Administrador

Máximo acceso funcional al producto.

Tiene las facultades de negocio de CEO y además:

- Acceso a ambas empresas.
- Gestión de cuentas Administrador.
- Configuración de integraciones y credenciales.
- Habilitación de capacidades restringidas, incluido Inventario de Servomotores.
- Activación/finalización de Modo de Pruebas.

Las acciones conservan el autor real.

#### CEO

Máxima autoridad funcional de negocio junto con Administrador.

Tiene acceso a ambas empresas y puede cambiar de contexto.

No puede:

- Ver ni administrar cuentas con rol Administrador.
- Acceder a credenciales de Integraciones.

Es el autorizador exclusivo de Órdenes de Compra.

#### Coordinación de Administración

Tiene acceso a ambas empresas mediante cambio de contexto.

Participa en:

- Facturación y Remisiones.
- Pagos y validación.
- Cobranza.
- CxP.
- Finanzas operativas.
- Compras y procesamiento de O.C. autorizadas.
- Personal/RRHH.
- Nómina.
- Comisiones en su preparación.
- Reportes permitidos.
- Proveedores.
- Comprobaciones pendientes.

No obtiene permisos técnicos por su acceso administrativo.

#### Gerente Operativo - SYSTRON

Puede:

- Asignar/reasignar Diagnósticos y OS.
- Cambiar estados técnicos globalmente.
- Validar todos los Diagnósticos terminados antes de que lleguen a cotización.
- Devolver un Diagnóstico a corrección con motivo/instrucción.
- Gestionar Refacciones e Inventario operativo.
- Registrar Compras directas y solicitar O.C.
- Capturar cotizaciones/documentos de proveedor externo.
- Crear/editar Proveedores.
- Resolver procesos operativos de producción.

En SYSTRON no ejecuta trabajo técnico, no se autoasigna y no recibe producción técnica por los trabajos de otros.

#### Gerente Operativo - Servomotores

Rol híbrido operativo/comercial/técnico de Servomotores.

Puede, dentro de Servomotores:

- Crear Clientes directos cuando corresponda.
- Crear y administrar MOT de clientes directos.
- Confirmar Ingresos físicos.
- Ejecutar Diagnóstico, Reparación y Diagnóstico de Garantía.
- Registrar Bitácora Técnica.
- Determinar resultado técnico.
- Crear Cotizaciones sin precio final cuando corresponda y gestionar su operación comercial.
- Cotizar a SYSTRON en operaciones intercompañía.
- Dar seguimiento comercial a clientes directos.
- Solicitar Factura o Remisión.
- Registrar Egresos físicos.
- Gestionar Compras directas y solicitar O.C.
- Operar Inventario si posteriormente es habilitado.

Su jefe directo es CEO.

Por su condición particular de socio, su relación laboral tiene reglas especiales definidas en Personal/Nómina.

#### Supervisor Técnico - SYSTRON

Es el principal asignador del Área Técnica.

Puede asignar/reasignar, cambiar estados técnicos globalmente, ejecutar trabajo, autoasignarse y registrar Bitácora Técnica.

#### Técnico - SYSTRON

Puede ver y operar trabajos propios, registrar avances, cambiar estados permitidos, solicitar refacciones y registrar horas extra.

No puede autoasignarse ni ver información financiera/comercial restringida.

#### Ventas - SYSTRON

Puede:

- Gestionar Prospectos y Clientes propios.
- Crear EQUI y MOT originados en SYSTRON.
- Crear atenciones.
- Iniciar Cotizaciones sin determinar el precio.
- Dar seguimiento comercial.
- Aplicar descuentos dentro de su límite individual configurado.
- Solicitar Factura.
- Solicitar Remisión.
- Registrar Pagos.
- Consultar Cobranza propia.
- Usar Agenda Comercial y Mi desempeño.

No ve costos internos, Cotización base de Servomotores, bancos, gastos globales, nómina ni finanzas globales.

#### Almacén - SYSTRON

Puede confirmar Entradas/Salidas, mantener custodia, operar movimientos físicos e Inventario y corregir movimientos conforme a dependencias.

No interviene en MOT enviados a Servomotores.

#### Ayudante General - Servomotores

Debe tener usuario por su relación con Personal/Nómina/Asistencia, pero no tiene panel ni acceso operativo a módulos de negocio.

Su jefe directo es el Gerente Operativo de Servomotores.

#### Kiosco de Asistencia

Acceso dedicado exclusivamente a marcaje de Entrada/Salida por huella para colaboradores a quienes aplique.

No es un panel operativo normal.

---

---

### 1.5 Acceso inicial

---

El sistema debe contemplar un usuario nativo inicial `Vectoria` con rol Administrador y acceso total.

La credencial inicial es información sensible y no debe exponerse posteriormente en interfaces, logs, documentos ni respuestas visibles.

CEO y Administrador pueden crear/editar/desactivar usuarios operativos y asignar roles fijos.

CEO no ve cuentas Administrador. Administrador sí puede administrarlas.

Los usuarios con acceso a ambas empresas deben cambiar explícitamente de empresa activa. El producto debe impedir ambigüedad visual sobre la empresa en la que se está trabajando.

Un mismo usuario puede mantener sesiones simultáneas. Los cambios concurrentes no pueden sobrescribirse silenciosamente.

---

---

## 2. Reglas transversales del sistema

---

### 2.1 Registros, folios, correcciones y trazabilidad

---

#### Folios

Los folios operativos son visibles, consecutivos, no reutilizables y no reinician por año.

Regla multiempresa:

- Cada empresa mantiene secuencias independientes para Cotizaciones, O.C., OS, Entradas/Salidas o Ingresos/Egresos físicos, Ventas y demás folios internos.
- `EQUI-...` pertenece a equipos de SYSTRON.
- `MOT-...` es la única secuencia global compartida entre SYSTRON y Servomotores.
- Si Servomotores crea `MOT-10`, el siguiente MOT creado desde SYSTRON será `MOT-11`.
- Los huecos de numeración visibles desde una empresa son válidos.

Los documentos fiscales conservan la numeración/identidad oficial que corresponda a cada razón social y proveedor fiscal.

#### Cancelación

Los registros principales no se eliminan cuando hacerlo destruye trazabilidad.

Cuando exista cancelación:

- Es explícita.
- Motivo obligatorio cuando corresponda.
- Conserva autor y fecha/hora.
- El folio no se reutiliza.
- Sale de vistas activas/totales vigentes.
- Permanece consultable.

Si ya existen consecuencias posteriores, se resuelven en el proceso correspondiente y no mediante borrado silencioso.

#### Reapertura técnica

Supervisor Técnico, Gerente Operativo, CEO y Administrador pueden reabrir estados terminales cuando su rol/empresa lo permita y no existan consecuencias incompatibles.

Exige motivo, autor, fecha/hora e historial.

#### Duplicados

La prevención funcional distingue entre **identidad exacta/efectos duplicados** y **similitud aproximada**.

Se bloquea cuando existe una regla exacta o riesgo real de duplicar un efecto, por ejemplo:

- Folios.
- Número de parte dentro del Inventario de una empresa cuando la regla vigente exige unicidad.
- Pago/comprobante duplicado.
- CFDI duplicado.
- Procesamiento financiero duplicado de una O.C./Compra.
- Otros casos explícitos.

En **altas rápidas**, la búsqueda previa es parte obligatoria del recorrido. Después de esa búsqueda no se requieren advertencias adicionales por similitud, coincidencias aproximadas ni sugerencias de fusión: si el usuario decide crear un nuevo registro, la responsabilidad operativa del posible duplicado es suya.

Fuera de altas rápidas, una vista de búsqueda puede mostrar resultados coincidentes de forma natural, pero no debe inventarse un sistema de deduplicación/fusión no definido.

No existe fusión automática.

#### Concurrencia

Si un registro cambió desde que otro usuario lo abrió, un segundo guardado no puede sobrescribir silenciosamente la versión nueva. El usuario debe conocer que existe una versión posterior y recargar antes de continuar.

---

---

### 2.2 Navegación, listados y detalle

---

#### Listados

El listado sirve para **encontrar, comparar y priorizar** registros. Debe mostrar únicamente la información necesaria para identificar el registro, entender su estado/responsable y decidir si requiere atención.

Un campo puede ser útil como filtro sin necesitar una columna permanente.

#### Vista de detalle

La vista de detalle es el **centro operativo** de toda entidad principal.

Cuando corresponda debe mostrar:

- folio, nombre o identidad principal;
- estado actual;
- relación principal, como Cliente, Proveedor o Colaborador;
- responsable;
- fecha relevante;
- prioridad o importe cuando sea útil y el rol tenga permiso;
- información funcional completa;
- relaciones existentes;
- documentos;
- acciones permitidas;
- historial funcional relevante;
- errores o pendientes.

Después de crear una entidad, el sistema abre su detalle. Después de editar, validar, autorizar, rechazar, cancelar, cerrar o ejecutar otra acción exitosa, el usuario **permanece en ese mismo detalle**.

#### Navegación natural

En listados, paneles, búsqueda y relaciones:

- si la entidad tiene folio, el **folio es el enlace al detalle**;
- si no tiene folio operativo visible, su **nombre principal** es el enlace;
- no usar botones redundantes como `Ver`, `Ver ficha` o `Abrir` cuando el folio/nombre ya cumple esa función;
- las acciones especiales sí tienen controles propios.

#### Relaciones

Solo se muestran relaciones que realmente existen.

Si una relación existe y el usuario tiene permiso para consultarla, debe poder abrirla desde el folio/nombre relacionado.

Cuando una acción genera una nueva entidad, ambas quedan relacionadas y navegables automáticamente.

La navegación entre entidades debe permitir regresar sin perder información no guardada.

---

### 2.3 Búsqueda

---

Las relaciones relevantes deben ser navegables desde la entidad actual.

Ejemplos:

- Cliente -> Equipos/MOT -> Atenciones.
- Diagnóstico -> Cotización -> OS.
- OS -> Refacciones -> Compra/O.C.
- Operación -> Factura/Remisión -> Pago/Cobranza.
- Proveedor -> Compras/CxP/Servicio Externo.
- MOT SYSTRON -> seguimiento técnico de Servomotores.
- Factura intercompañía -> CxC Servomotores / CxP SYSTRON.

#### Búsqueda global

Existe una búsqueda global discreta solo para:

- CEO.
- Administrador.

Busca al menos:

- Clientes.
- Prospectos.
- EQUI/MOT visibles.
- Diagnósticos.
- OS.
- Cotizaciones.
- Ventas.
- Facturas.
- Proveedores.

Puede localizar por folio, nombre/razón social, serie, modelo, referencia, factura u otros identificadores relevantes.

Respeta la empresa activa y permisos. En SYSTRON solo aparecen MOT originados en SYSTRON; en Servomotores aparecen sus MOT directos y los MOT recibidos desde SYSTRON.

La búsqueda abre el detalle; no habilita edición especial.

#### Archivos

No existe módulo documental general.

Los archivos persistentes pertenecen a la infraestructura VectorIA y se consultan/descargan desde la entidad de origen. Los adjuntos manuales solo existen donde son funcionalmente necesarios.

---

---

### 2.4 Altas rápidas

---

Cuando un proceso dependa de una entidad previa:

1. el usuario primero busca la entidad;
2. si no existe y tiene permiso normal para crearla, aparece `Crear nuevo`;
3. captura únicamente la información mínima necesaria;
4. guarda;
5. regresa al mismo punto del proceso sin perder información;
6. la nueva entidad queda seleccionada automáticamente.

La alta rápida crea una entidad válida, no un registro provisional.

No se requiere detección inteligente de similitud ni bloqueo por posibles duplicados: la búsqueda previa es responsabilidad operativa del usuario. El sistema sí conserva las unicidades propias, por ejemplo folios generados.

Aplicaciones mínimas cuando el rol tenga permiso:

- Cotización, Atención, Equipo o Factura libre → Cliente;
- Cotización/envío → Contacto;
- Compra/O.C./CxP/Servicio Externo → Proveedor;
- EQUI → Tipo y Marca;
- entrega → Courier cuando aplique.

No usar alta rápida para usuarios, Colaboradores, roles, cuentas bancarias, credenciales, Facturas, Pagos, Nóminas ni documentos que requieran autorización formal.

---

### 2.5 Campos: obligatoriedad, procedencia y visibilidad

---

Cada entidad principal debe definir sus campos funcionales relevantes.

#### Requisito del campo

- `Obligatorio al crear`: sin él no nace válidamente el registro.
- `Obligatorio para avanzar`: puede faltar al inicio, pero una acción/estado posterior lo exige.
- `Condicional`: obligatorio solo cuando se cumple cierta condición.
- `Opcional`: puede permanecer vacío.
- `Automático`: lo genera o deriva el sistema.

#### Procedencia

- capturado;
- heredado;
- referenciado;
- calculado;
- generado;
- fotografía histórica.

Cuando aporte valor también se debe indicar:

- quién puede modificarlo;
- si se muestra en listado, detalle, acción o historial;
- si cambios posteriores del dato origen se propagan o no.

No se debe exigir durante el alta inicial información que solo será necesaria en una fase posterior del proceso.

---

### 2.6 Ruta de creación

---

Toda creación importante debe especificar una **ruta funcional**:

`desde dónde se inicia → qué información solicita → qué es obligatorio/condicional → qué altas rápidas permite → qué validaciones aplica → qué entidad crea → con qué estado nace → qué automatizaciones dispara → dónde queda el usuario`.

La secuencia define el orden lógico de información, no obliga a usar un wizard ni prescribe la interfaz técnica.

---

### 2.7 Acciones por estado y rol

---

Las acciones disponibles dependen de **estado + rol + condiciones**.

La vista de detalle debe distinguir:

1. **acción principal**, la que hace avanzar naturalmente el proceso;
2. **acciones secundarias**, como editar, descargar, enviar o abrir relaciones;
3. **acciones excepcionales o sensibles**, como cancelar, rechazar, reabrir o devolver.

No mostrar acciones que el rol no puede ejecutar ni acciones incompatibles con el estado actual.

Si una acción es válida pero falta una configuración o condición externa, puede mostrarse deshabilitada explicando qué falta.

---

### 2.8 Crear, editar, cancelar, eliminar, cerrar e inactivar

---

No asumir CRUD completo.

- **Crear:** dar de alta una entidad válida.
- **Editar:** modificar datos permitidos mientras estado/rol lo permitan.
- **Cancelar:** detener una entidad válida conservando historia.
- **Eliminar:** excepcional, solo cuando no destruye historia ni dependencias.
- **Cerrar:** terminar correctamente su ciclo.
- **Inactivar:** evitar uso futuro conservando historia, cuando corresponda.

Facturas, Pagos, Nóminas, movimientos financieros y registros con consecuencias posteriores no se corrigen mediante eliminación silenciosa.

---

### 2.9 Historial funcional

---

No se requiere auditoría universal.

Conservar historial cuando un cambio afecte:

- decisiones;
- autorizaciones;
- estados;
- dinero;
- responsabilidad;
- documentos;
- consecuencias posteriores.

Ejemplos: devolución de Diagnóstico, cambio material de O.C. autorizada, decisión técnica de Garantía, cambio de salario/jefe, cancelación fiscal y movimientos de custodia.

Datos administrativos no críticos pueden sustituir su valor vigente sin conservar versiones exhaustivas.

---

### 2.10 Documentos y archivos

---

Los documentos formales deben tener presentación profesional e identidad de la empresa emisora.

Cuando Facturapi entrega documento oficial se conserva el documento oficial.

Archivos relevantes:

- Cotizaciones PDF.
- Facturas PDF/XML.
- CFDI Nómina PDF/XML.
- Consolidado interno de Nómina.
- Descarga masiva de Nómina.
- Remisiones.
- Documentos de Salida/Egreso.
- Documentos de Salida a proveedor.
- O.C. cuando deba imprimirse/consultarse.
- Reportes/exportaciones persistentes cuando corresponda.
- Comprobantes de Pago.
- PO opcional.
- Evidencia comercial.
- Documentos laborales.
- Documentos/cotizaciones de proveedor externo.

No se agrega un adjunto genérico a todas las entidades.

---

---

### 2.11 Integridad histórica y procedencia

---

Se congelan cuando corresponda:

- Empresa emisora y datos fiscales de documentos.
- Dirección/destinatario de Salida/Egreso.
- Días de crédito en operación.
- SLA, prioridad, tarifa e incremento.
- Precio base/final de una Cotización conforme a su revisión.
- Datos intercompañía relevantes.
- Parámetros de comisión/Nómina.
- Cuenta bancaria de colaborador.
- Parámetros de bonos/metas.
- Límites de compra aplicables al momento de registrar/autorización.

Cambios posteriores de catálogos no reescriben operaciones históricas.

Se conserva historia funcional en asignaciones/estados, validaciones de Diagnóstico, devoluciones a corrección, Cotizaciones/revisiones, Entradas/Salidas/Egresos, Bitácora Técnica, Pagos, Compras/O.C., movimientos financieros, jefe directo, salarios, Vacaciones, Horas extra, Nómina, Comisiones, Garantías y Servicio Externo.

En intercompañía se conserva el vínculo entre ambos lados sin fusionar sus registros administrativos.

No existe auditoría genérica de cada campo; el historial debe ser discreto y de acceso restringido cuando corresponda.

---

---

### 2.12 Estado vacío, errores y reintentos

---

Toda vista relevante debe contemplar:

- Vacío.
- Procesando.
- Éxito.
- Error recuperable.
- Error externo.
- Integración desconectada.
- Configuración faltante.
- Reintento.

El usuario debe entender:

- Qué ocurrió.
- Si la operación quedó guardada o no.
- Qué puede hacer a continuación.

No se exige una implementación visual específica.

---

---

### 2.13 Estándar visual y experiencia

---

El producto debe sentirse:

- Moderno.
- Profesional.
- SaaS.
- Sobrio.
- Rápido de operar.
- Tema claro.
- Sin decoración innecesaria.

Debe priorizar:

- Jerarquía.
- Tablas legibles.
- Filtros útiles.
- Estados claros.
- Formularios ordenados.
- Detalles operativos.
- Navegación entre relaciones.

Evitar:

- Dashboards decorativos.
- Gradientes excesivos.
- Animaciones innecesarias.
- Modales sin necesidad.
- Densidad visual inútil.

Móvil:

- Mantiene funciones esenciales.
- Agenda y operación rápida adaptadas.
- No desaparecen acciones críticas.

PWA:

- Instalable cuando sea razonable.
- Sin asumir offline.

---

---

## 3. Área Comercial

---

### 3.1 Módulo Clientes

---

#### Objetivo

Mantener la identidad comercial del Cliente, sus contactos, condiciones vigentes y relaciones operativas dentro de una sola empresa.

#### Ruta de alta

Alta directa desde Clientes o alta rápida desde un proceso que necesite Cliente y donde el usuario tenga permiso de creación.

El alta rápida debe solicitar solo la información mínima necesaria para identificar al Cliente y continuar. Los datos fiscales pueden completarse posteriormente antes de ejecutar una acción que realmente los necesite.

#### Campos funcionales relevantes

| Campo | Requisito | Procedencia |
|---|---|---|
| Empresa | Automático | Contexto activo |
| Nombre / razón social | Obligatorio al crear | Capturado |
| Responsable comercial | Automático/condicional | Regla según creador |
| Clasificación | Opcional | Capturado |
| Requiere factura | Obligatorio antes de operar facturación | Capturado |
| Días de crédito | Condicional | Capturado |
| Datos fiscales | Obligatorio para facturar | Capturado |
| Dirección de entrega | Condicional | Capturado |

#### Listado y detalle

El nombre/razón social abre el detalle.

El detalle debe concentrar datos generales, Contactos, condiciones comerciales/fiscales y relaciones existentes.

#### Relaciones navegables

Cuando existan: Contactos, Prospecto origen, EQUI/MOT, Atenciones, Diagnósticos, OS/Reparaciones, Cotizaciones, Ventas, Facturas/Remisiones, Pagos y Cobranza.

---

#### Reglas detalladas

---

Cada empresa mantiene su propio catálogo de Clientes.

##### Alta y responsable

SYSTRON:

- Vendedor, Coordinación, CEO y Administrador pueden crear Clientes.
- Si lo crea Vendedor, ese Vendedor queda responsable.
- Si lo crea Coordinación, el responsable inicial es CEO.
- Solo CEO/Administrador reasignan responsable.

Servomotores:

- Gerente Operativo, Coordinación, CEO y Administrador pueden crear Clientes directos conforme a sus funciones.
- Las operaciones provenientes de SYSTRON no crean al cliente final dentro de Servomotores; utilizan el Cliente intercompañía fijo `SYSTRON`.

##### Contactos

Un Cliente puede tener múltiples contactos con:

- Nombre.
- Teléfono.
- Puesto/cargo.
- Correo.

Existe un contacto principal/default.

Al enviar Cotización u otra comunicación se preselecciona el principal, pero pueden elegirse otro o varios contactos sin cambiar el default.

##### Otros campos funcionales

- Nombre/Razón social.
- Clasificación Normal/Premium cuando aplique.
- Responsable comercial.
- Dirección de envío vigente.
- Identidad fiscal vigente.
- Días de crédito.
- `Requiere factura`: Sí/No.
- Documentos definidos.

Los contactos pueden inactivarse. El Cliente principal no se elimina para perder historial.

##### Requiere factura

Puede editarlo el responsable autorizado, Coordinación, CEO o Administrador.

Cambios afectan operaciones abiertas conforme a la regla vigente, sin reescribir Facturas/documentos históricos.

##### Crédito

La Cotización hereda los días vigentes, puede modificarse antes de autorización y congela el valor al autorizarse.

##### Duplicados y detalle

En alta rápida, la búsqueda previa sustituye cualquier advertencia adicional por similitud. No se bloquea ni se propone fusión por nombres parecidos; se conservan únicamente las unicidades exactas que correspondan.

El detalle debe navegar a contactos, EQUI/MOT, Diagnósticos, Cotizaciones, OS, Ventas, Facturas, Pagos, Cobranza e historial aplicable, respetando empresa y permisos.

---

---

### 3.2 Módulo Prospectos

---

#### Ciclo

`Nuevo → En seguimiento → Convertido / Descartado`.

El nombre/empresa abre su detalle. Si está convertido, desde el Prospecto se puede abrir el Cliente resultante.

---


#### Ruta, detalle y acciones

**Alta**
1. Crear desde Prospectos.
2. Capturar identidad del Prospecto, responsable y datos mínimos de contacto/contexto disponibles.
3. Guardar.
4. Abrir su detalle.

**Detalle**
Debe concentrar datos del Prospecto, responsable, seguimientos/actividades comerciales y relación con Cliente cuando exista conversión.

**Acciones por ciclo**
- `Nuevo` / `En seguimiento`: editar datos permitidos, registrar actividad y convertir o descartar.
- `Convertido`: conservar como antecedente y navegar al Cliente resultante.
- `Descartado`: conservar historial; cualquier reactivación debe ser explícita si la regla lo permite.

La conversión no crea un Cliente duplicado cuando el usuario selecciona uno ya existente. La relación Prospecto → Cliente queda navegable en ambos sentidos cuando aporte valor.

#### Reglas detalladas

---

Cada empresa puede mantener Prospectos previos a Cliente.

Campos principales:

- Empresa/Nombre, obligatorio.
- Responsable comercial.
- Fuente.
- Nota.

Estados:

- Nuevo.
- En seguimiento.
- Convertido.
- Descartado.

Puede existir log comercial con interacción, nota y siguiente seguimiento opcional, sin recordatorios automáticos.

La conversión a Cliente es manual:

- Conserva el Prospecto y vínculo.
- No permite convertirlo dos veces.
- En SYSTRON el responsable comercial se convierte en Vendedor responsable.
- En Servomotores el Gerente Operativo puede llevar el seguimiento comercial de Prospectos/Clientes directos conforme a su rol.

---

---

### 3.3 Módulo Cotizaciones

---

#### Objetivo

Gestionar determinación de precio, presentación, seguimiento y decisión comercial. `Pendientes de cotizar` es una **bandeja del módulo**, no un módulo separado.

#### Rutas de creación

**Cotización iniciada por Vendedor**
1. Buscar/seleccionar Cliente o usar alta rápida.
2. Seleccionar tipo de Cotización.
3. Seleccionar EQUI/MOT existente o indicar que aún no ha ingresado.
4. Si no existe equipo físico, capturar identificación preliminar necesaria: Tipo de equipo, Marca, Modelo y Serial si se conoce.
5. Capturar concepto/contexto, cantidades cuando apliquen, Contactos y referencia comercial opcional.
6. Guardar sin precio.
7. Nace `Pendiente de cotizar`.
8. Se abre el detalle.

**Desde Diagnóstico validado**
El sistema genera/prepara el pendiente con Cliente, equipo, Diagnóstico origen y contexto técnico relacionados.

**Desde Reparación preautorizada**
Cuando puede determinarse precio, genera el pendiente relacionado con Reparación/OS.

**Desde MOT Servomotores**
La Cotización base Servomotores genera el pendiente SYSTRON para CEO/Administrador, respetando confidencialidad.

**Desde Garantía no procedente**
Cuando se decide cobrar, entra a la misma bandeja.

#### Campos relevantes

| Campo | Requisito | Procedencia |
|---|---|---|
| Empresa | Automático | Contexto activo |
| Folio | Automático | Generado |
| Cliente | Obligatorio al crear | Referenciado |
| Tipo | Obligatorio al crear | Capturado |
| Origen | Automático/condicional | Referenciado |
| EQUI/MOT | Condicional | Referenciado |
| Tipo de equipo / Marca / Modelo preliminar | Condicional si no existe equipo físico | Capturado/referenciado |
| Serial preliminar | Opcional | Capturado |
| Contactos/destinatarios | Obligatorio para enviar | Referenciado |
| Conceptos/cantidades | Obligatorio para cotizar | Capturado/heredado |
| Precio | Obligatorio para pasar a decisión | Capturado por CEO/Administrador |
| IVA | Automático según regla | Calculado |
| Descuento | Opcional | Capturado dentro de permisos |
| Referencia comercial | Opcional | Capturado |
| Crédito | Condicional | Heredado/ajustado |
| Estado | Automático | Ciclo |

#### Listado y detalle

Listado: folio, Cliente, equipo o referencia preliminar, tipo/origen, responsable, total cuando exista, estado y fecha relevante.

El **folio abre el detalle**.

El detalle muestra Cliente/Contactos, equipo o información preliminar, origen, conceptos, precio/IVA/descuento/total según permisos, crédito, documentos, historial relevante y relaciones existentes.

#### Relaciones navegables

Cuando existan: Cliente, Contactos usados, EQUI/MOT, Diagnóstico origen, OS/Reparación, Venta, Factura(s), Remisión(es), Pagos/Cobranza y Cotización intercompañía para roles autorizados.

#### Acciones principales por estado

- `Pendiente de cotizar` → **Asignar precio** → CEO/Administrador → `Pendiente de decisión`.
- `Pendiente de decisión` → Enviar/seguir/aplicar descuento permitido → Vendedor.
- `Pendiente de decisión` → Registrar Autorizada/No autorizada → rol permitido.
- `Autorizada` → acciones posteriores como Solicitar Factura/Remisión o continuar proceso según tipo.
- `Autorizada — Pendiente de ingreso de equipo` → espera alta/relación del equipo e Ingreso físico antes de OS.

---


#### Recorridos operativos consolidados

##### Cotización de servicio/equipo iniciada por Vendedor
`Cliente → tipo de Cotización → equipo existente o identificación preliminar → conceptos/contexto → contactos → guardar → Pendiente de cotizar → CEO/Administrador fija precio → Pendiente de decisión → Vendedor gestiona envío/seguimiento → Autorizada/No autorizada`.

Cuando aún no existe EQUI/MOT físico, la captura comercial debe pedir los datos preliminares necesarios para reconocer lo cotizado, incluyendo Tipo, Marca, Modelo y Serial cuando se conozca, sin crear artificialmente el equipo permanente.

##### Cotización desde Diagnóstico
`Diagnóstico validado → Pendiente de cotizar → CEO/Administrador fija precio → Vendedor gestiona decisión`.

Cliente, EQUI/MOT, Diagnóstico origen y contexto técnico se heredan/referencian; no deben volver a capturarse como si fueran independientes.

##### Reparación preautorizada pendiente de precio
`Reparación técnicamente terminada o lista para precio → Pendiente de cotizar → CEO/Administrador captura base → sistema aplica incremento de prioridad vigente congelado → Vendedor gestiona decisión comercial`.

##### Servicio en campo
La Cotización debe identificar Cliente, servicio/concepto, alcance comercial y destinatarios necesarios. No crea permanentemente una máquina, EQUI u OS si la regla del servicio en campo no lo requiere.

##### Venta de equipo
Puede contener múltiples líneas/cantidades. La autorización parcial crea Venta únicamente por las líneas autorizadas; una autorización posterior de líneas adicionales genera la Venta correspondiente conforme a la regla vigente.

##### Handoffs
- `Pendiente de cotizar` → responsable: CEO/Administrador → bandeja unificada `Pendientes de cotizar`.
- Precio definido → responsable comercial: Vendedor/Gerente Operativo Servomotores según empresa → Panel/seguimiento comercial.
- `Autorizada` → aparecen las acciones posteriores válidas: ingreso físico/OS, Venta, solicitud de Factura/Remisión u otras según tipo.
- `No autorizada` → conserva historial y deja de aparecer como pendiente activo.

El detalle debe mostrar claramente **qué falta para avanzar**. No debe presentar como acción disponible una operación que todavía no sea compatible con su estado.

#### Reglas detalladas

---

##### Tipos

- Diagnóstico.
- Reparación/Servicio.
- Servicio en campo.
- Venta de equipo.

##### Principio `Pendiente de cotizar`

Se unifican en una sola bandeja del CEO/Administrador los casos que necesitan determinación de precio.

Pueden originarse por:

- Cotización iniciada por Vendedor sin precio.
- Diagnóstico validado.
- Reparación preautorizada pendiente de precio.
- MOT con Cotización base de Servomotores.
- Garantía no procedente que se decide cobrar.
- Otros recorridos expresamente equivalentes.

Cada pendiente identifica su origen.

##### Vendedor

El Vendedor puede iniciar una Cotización y capturar el contexto:

- Cliente.
- Equipo o datos preliminares.
- Servicio/producto solicitado.
- Contactos destinatarios.
- Cantidades.
- Referencia comercial/PO u observación.
- Otros datos no económicos permitidos.

No fija ni edita el precio.

CEO/Administrador determina y edita precios y condiciones económicas.

Después de que existe precio, Vendedor puede:

- Dar seguimiento.
- Seleccionar uno o varios contactos para envío.
- Enviar.
- Registrar decisión del cliente.
- Aplicar descuento dentro de su máximo individual configurado.

El porcentaje máximo de descuento del Vendedor se configura en su ficha por CEO/Administrador. No puede excederlo. CEO/Administrador no queda limitado por ese máximo.

##### Estados comerciales

- Pendiente de cotizar.
- Pendiente de decisión.
- Autorizada.
- No autorizada.

No se exige evidencia documental ni expiración.

##### Moneda, IVA y crédito

- MXN.
- Precios antes de IVA.
- IVA 16%.
- Descuento global cuando corresponda.
- Días de crédito heredados del Cliente y congelados al autorizar.

##### Cotización sin equipo físico

Puede crearse antes de que exista EQUI/MOT usando información preliminar.

Si se autoriza:

- Queda `Autorizada - Pendiente de ingreso de equipo`.
- No crea OS todavía.
- Al llegar el equipo, se crea/relaciona EQUI o MOT y se confirma Ingreso físico.
- Solo entonces inicia el proceso técnico/OS correspondiente.

Cuando no existió Diagnóstico previo, CEO/Administrador puede modificar posteriormente el importe autorizado al descubrir el alcance real. Se conservan revisiones. Si ya existen efectos fiscales/pagos, la regularización debe respetar la historia.

##### Reparación

Para reparación preautorizada se conserva:

- Precio base.
- Porcentaje de prioridad congelado.
- Precio final.

El cliente solo ve el precio final.

##### MOT intercompañía

Servomotores emite una Cotización propia a su Cliente `SYSTRON`.

En SYSTRON:

- CEO/Administrador sí puede ver la Cotización base.
- Vendedor no puede verla.
- CEO usa ese importe como costo/base interno para determinar la Cotización final al cliente.

En Servomotores:

- Gerente Operativo no ve el precio final ni margen de SYSTRON.

Cuando el cliente final autoriza/no autoriza la Cotización SYSTRON, la Cotización vinculada de Servomotores recibe automáticamente la misma decisión.

No se agrega un subflujo especial de recotización intercompañía; excepciones se resuelven con las reglas normales de revisión.

##### Referencia comercial y documento

Existe texto libre `Información complementaria / Referencia comercial`. Se hereda a facturación cuando corresponda y los documentos históricos conservan su fotografía.

Debe generarse PDF profesional de la empresa emisora.

---

---

### 3.4 Módulo Ventas de equipo

---

La Venta nace de líneas autorizadas de una Cotización de Venta de equipo.

El folio de Venta abre su detalle. Debe mostrar líneas, cantidades vendidas/recibidas/entregadas, documentos y movimientos físicos existentes.

Relaciones: Venta ↔ Cotización ↔ Cliente ↔ movimientos de Almacén ↔ Factura/Remisión.

---


#### Recorrido operativo

`Cotización de Venta de equipo autorizada → Venta → compra/adquisición cuando corresponda → recepción parcial/total → material disponible → aviso/visibilidad comercial → Factura/Remisión cuando corresponda → entrega parcial/total → cierre`.

Reglas de operación:

- La Venta nace únicamente de líneas autorizadas.
- Cada línea conserva cantidad vendida, recibida, entregada y pendiente.
- Recibir parcialmente no marca toda la Venta como disponible.
- Entregar parcialmente no cierra cantidades pendientes.
- El Panel de Ventas debe mostrar Entregas pendientes cuando exista material listo.
- El detalle de Venta debe abrir Cotización origen, Cliente, recepciones/movimientos físicos, Factura/Remisión y Compras relacionadas cuando existan.
- La Factura puede emitirse antes de que llegue la mercancía conforme a la regla vigente; esto no simula recepción ni entrega.

#### Reglas detalladas

---

`Venta` es entidad separada de OS y nace de líneas autorizadas de una Cotización de Venta.

Puede facturarse antes de la recepción física.

La compra del bien se gestiona desde `Compras` y, cuando requiera autorización, mediante O.C. conforme a las reglas vigentes.

Almacén recibe contra líneas/cantidades de la Venta. La mercancía no se convierte en Inventario de refacciones.

Se permite entrega parcial.

Cada línea puede reflejar:

- Vendido.
- Recibido.
- Entregado.
- Pendiente.

Solo se entrega cantidad físicamente disponible y con Factura/Remisión habilitante.

Cancelación: solo CEO/Administrador cuando la cadena lo permita; si existen efectos posteriores se regularizan sin borrar historia.

---

---

### 3.5 Seguimiento comercial

---

#### Agenda Comercial

---

Agenda Día/Semana/Mes para usuarios con responsabilidad comercial en su empresa.

Usuarios principales:

- Vendedor SYSTRON.
- Gerente Operativo Servomotores para clientes directos.
- CEO cuando apoye comercialmente.

No genera recordatorios/notificaciones automáticas.

Puede registrar:

- Tipo/categoría.
- Cliente opcional.
- Prospecto opcional.
- Actividad sin relación.
- Nota/resultado.
- Evidencia opcional.

Si se relaciona con Cliente/Prospecto, aparece también en su historial.

En móvil existe acción rápida para registrar actividad.

Las categorías pueden crearse conforme a permisos; CEO/Administrador administran/inactivan categorías y definen cuáles cuentan para metas.

La evidencia puede ser requisito para que una actividad medible cuente para metas, sin requerir aprobación separada.

---

---


**Integración obligatoria con Panel de Ventas y entidades comerciales**

- El Panel de Ventas debe mostrar un bloque/resumen de `Agenda / próximas actividades`.
- Desde ese bloque se abre la Agenda Comercial completa.
- La Agenda completa conserva vistas Día/Semana/Mes y creación de actividad.
- Cuando una actividad está relacionada con Cliente o Prospecto, su nombre abre el detalle correspondiente.
- En el detalle de Cliente/Prospecto se muestran las actividades comerciales existentes que correspondan.
- Registrar una actividad no crea automáticamente recordatorios ni tareas adicionales.

#### Metas comerciales

---

Las metas comerciales formales actuales aplican principalmente al equipo de Ventas de SYSTRON.

Son mensuales.

CEO/Administrador mantiene catálogo de tipos de meta y objetivo mensual por Vendedor.

Cambiar objetivo durante el mes afecta el mes actual; un mes cerrado conserva su objetivo histórico.

Las fuentes pueden ser:

- Actividades con evidencia.
- Datos automáticos de módulos.

Meta inicial obligatoria SYSTRON:

`Clientes nuevos`.

Un Cliente cuenta como nuevo cuando tiene su primera operación real, no por el simple alta. Se atribuye al responsable comercial vigente en ese momento y las reasignaciones posteriores no reescriben historia.

Servomotores puede usar Agenda Comercial sin obligar a configurar metas formales para su Gerente Operativo en el alcance actual.

---

---

## 4. Área Operación Técnica

---

### 4.1 Módulo Equipos — EQUI y MOT

---

#### Objetivo

Conservar identidad física e historial de EQUI y MOT.

#### Ruta EQUI

1. Buscar/seleccionar Cliente.
2. Seleccionar Tipo; alta rápida si está permitida.
3. Seleccionar Marca; alta rápida si está permitida.
4. Capturar Modelo obligatorio.
5. Descripción opcional.
6. Serial opcional.
7. Crear folio/etiqueta.
8. Abrir detalle.

#### Ruta MOT SYSTRON

1. Cliente final SYSTRON.
2. Capturar identificación del motor/servomotor.
3. Seleccionar Tipo de Atención.
4. Seleccionar Prioridad aplicable.
5. Crear folio MOT global.
6. Crear/relacionar operación Servomotores pendiente de Ingreso físico.
7. Abrir detalle.

#### Ruta MOT Servomotores directo

1. Buscar/crear Cliente Servomotores.
2. Capturar identificación.
3. Seleccionar Atención.
4. Seleccionar Prioridad.
5. Crear folio MOT global.
6. Continuar al Ingreso.
7. Abrir detalle.

#### Navegación

El folio EQUI/MOT abre detalle. Desde el detalle se navega a Cliente, Atenciones, Diagnósticos, OS/Reparaciones, Garantías, movimientos físicos, Cotizaciones y documentos existentes.

---


#### Separación entre identidad física y Atención

Crear `EQUI` o `MOT` crea la **identidad física**. Crear una Atención crea un **nuevo episodio de servicio** sobre esa identidad.

Cuando el alta de MOT se realiza dentro del recorrido de un servicio, la interfaz puede encadenar ambas acciones, pero funcionalmente deben quedar diferenciadas:

1. identificar/crear MOT;
2. crear Atención sobre ese MOT;
3. seleccionar Tipo de Atención;
4. seleccionar prioridad aplicable;
5. continuar a Ingreso físico.

Esto evita que un MOT quede confundido con un Diagnóstico/Reparación específico y permite acumular múltiples atenciones históricas sobre el mismo MOT.

#### Recorrido maestro MOT intercompañía

Para MOT originado en SYSTRON:

`SYSTRON crea/identifica MOT → crea Atención → Servomotores recibe pendiente de Ingreso → confirma Ingreso físico → inicia SLA → ejecuta Diagnóstico/Reparación y Bitácora → SYSTRON consulta estado/Bitácora en solo lectura → Servomotores determina/captura Cotización base cuando corresponde → SYSTRON recibe Pendiente de cotizar → CEO/Administrador define precio final → Vendedor gestiona decisión del cliente → decisión se propaga a Servomotores → ejecución/entrega según caso → Factura Servomotores→SYSTRON cuando administrativamente corresponda → CxC Servomotores + CxP SYSTRON → pago real entre cuentas`.

Restricciones obligatorias durante todo el recorrido:

- Vendedor SYSTRON no ve precio/costo base Servomotores.
- Gerente Operativo Servomotores no ve precio final ni margen SYSTRON.
- SYSTRON no edita estado ni Bitácora Técnica de Servomotores.
- Servomotores identifica administrativamente a `SYSTRON` como Cliente intercompañía; el cliente final no se convierte en Cliente comercial de Servomotores.
- Las instrucciones mínimas de receptor final pueden propagarse para entrega directa sin exponer información comercial innecesaria.

#### Reglas detalladas

---

##### EQUI - equipos SYSTRON

`EQUI-...` identifica una unidad física permanente atendida por SYSTRON que no pertenece al flujo de motor/servomotor.

El folio y etiqueta interna son la identidad principal. El serial de fabricante es opcional/descriptivo.

Si regresa con etiqueta SYSTRON se reutiliza el mismo Equipo e historia. Si llega sin etiqueta, no se infiere ni fusiona automáticamente.

Campos principales:

- Cliente.
- Folio.
- Tipo.
- Marca.
- Modelo obligatorio.
- Descripción opcional.
- Serial opcional.

La falla reportada pertenece a la Atención, no al Equipo.

El Vendedor crea el EQUI antes de la Entrada formal de Almacén. Una Cotización preliminar puede existir antes del equipo físico sin crear EQUI.

##### MOT - motor/servomotor

Todo motor/servomotor utiliza `MOT-...`.

No existe la modalidad antigua `Diagnóstico Servomotor` en SYSTRON.

MOT es una identidad física global compartida entre empresas con una única secuencia.

Visibilidad:

- SYSTRON solo ve MOT originados en SYSTRON.
- Servomotores ve MOT de sus clientes directos y MOT originados en SYSTRON.

Un MOT originado en SYSTRON se sabe desde su creación que será trabajado por Servomotores.

##### Operación intercompañía sobre MOT

Cuando SYSTRON crea un MOT y una Atención:

1. No ingresa al Almacén SYSTRON.
2. Se genera la operación relacionada de Servomotores.
3. En Servomotores el cliente administrativo es el Cliente fijo `SYSTRON`.
4. El contacto operativo es el Vendedor SYSTRON responsable.
5. El Gerente Operativo de Servomotores recibe un pendiente de Ingreso físico.
6. Al confirmar Ingreso inicia el SLA y el servicio seleccionado.
7. Ambas empresas conservan operaciones administrativas separadas ligadas al mismo MOT.

Servomotores no accede al Cliente final de SYSTRON como Cliente comercial ni a sus condiciones/precio final. Para una entrega física directa puede recibir solo los datos de destinatario/instrucciones necesarios.

##### Seguimiento visible en SYSTRON

SYSTRON puede consultar, en modo solo lectura:

- Estado técnico actual de Servomotores.
- Última actualización.
- Bitácora Técnica completa correspondiente a ese MOT.

Los estados técnicos se originan en Servomotores; SYSTRON no los modifica.

La Cotización base Servomotores -> SYSTRON y los costos/márgenes internos no son visibles al Vendedor.

##### Detalle

EQUI/MOT deben navegar a Atención, Diagnóstico, Cotización, OS, Garantías, movimientos físicos, facturación y antecedentes aplicables según empresa y permisos.

---

---

### 4.2 Entrada a la operación técnica — Atención

---

Crear un servicio técnico **debe solicitar explícitamente tipo de Atención y prioridad**.

Ruta general:

1. seleccionar Cliente;
2. seleccionar EQUI/MOT o crearlo si el flujo lo permite;
3. seleccionar Tipo de Atención:
   - Diagnóstico;
   - Reparación;
   - Diagnóstico de Garantía;
4. capturar falla reportada/contexto;
5. seleccionar Prioridad del catálogo correspondiente a tipo y empresa;
6. relacionar antecedente obligatorio cuando sea Garantía;
7. crear;
8. abrir detalle;
9. el SLA inicia con la recepción física definida, no simplemente por crear la Atención.

La interfaz puede resolverlo en un formulario o pasos; lo obligatorio es que la ruta funcional no omita esos datos.

---


#### Ruta obligatoria de creación de Atención

Toda creación de servicio técnico debe resolver explícitamente:

1. Cliente/contexto de empresa.
2. EQUI/MOT existente o alta válida de la identidad física.
3. **Tipo de Atención**:
   - Diagnóstico;
   - Reparación;
   - Diagnóstico de Garantía.
4. Falla reportada/motivo/contexto.
5. **Prioridad aplicable** al tipo de Atención según la configuración vigente.
6. Antecedente obligatorio cuando sea Diagnóstico de Garantía.
7. Creación de la Atención.
8. Apertura del detalle resultante.
9. Posterior confirmación de Entrada/Ingreso físico, que es el evento que inicia el SLA cuando así está definido.

La captura no puede omitir Tipo de Atención ni la prioridad cuando ese tipo tenga un catálogo de prioridad definido.

**Diagnóstico de Garantía:** el Discovery no define un recargo económico adicional específico por prioridad de Garantía. No se debe inferir ni cobrar uno automáticamente por analogía con Diagnóstico/Reparación. Si utiliza prioridad operativa para orden/SLA, debe respetar la configuración aplicable sin inventar un cargo no definido.

#### Reglas detalladas

---

Los tipos técnicos vigentes son:

- `Diagnóstico`.
- `Reparación`.
- `Diagnóstico de Garantía`.

`Reparación` significa reparación preautorizada por el cliente antes de determinar el precio final dentro del ERP.

No existe `Reparación urgente`.

En SYSTRON, un MOT siempre deriva su ejecución técnica a Servomotores.

La falla reportada y contexto de la solicitud pertenecen a la Atención.

---

---

### 4.3 Módulo Diagnósticos

---

#### Ruta funcional

Atención `Diagnóstico` o `Diagnóstico de Garantía` → recepción física → asignación → ejecución → resultado técnico → validación Gerente Operativo → siguiente proceso.

#### Campos relevantes

| Campo | Requisito |
|---|---|
| EQUI/MOT | Obligatorio |
| Tipo de Atención | Obligatorio |
| Falla/contexto | Obligatorio |
| Prioridad | Obligatorio |
| Precio/SLA de Diagnóstico | Automático y congelado |
| Responsable técnico | Obligatorio para ejecutar |
| Resultado técnico | Obligatorio para terminar |
| Estado | Automático |

#### Listado y detalle

El folio abre detalle. Debe mostrar Cliente, equipo, prioridad, responsable, SLA, Bitácora, resultado, validación y relaciones.

#### Estados y acciones

`En espera → En diagnóstico → Diagnóstico terminado → Pendiente validación Gerente Operativo → Validado`

El Gerente Operativo puede `Devolver a corrección` con motivo; el trabajo debe volver a terminarse antes de una nueva validación.

Validado y cotizable → aparece automáticamente en `Pendientes de cotizar`.

---


#### Recorrido operativo completo

##### Diagnóstico interno SYSTRON
`Atención + Ingreso físico → En espera → asignación → En diagnóstico → Bitácora → Diagnóstico terminado → Pendiente validación Gerente Operativo → Validado o Devuelto a corrección`.

Handoffs:
- Sin asignar / pendiente → Supervisor/Gerente Operativo según facultad → Panel técnico.
- Asignado → Técnico/Supervisor ejecutor → Panel Técnico.
- `Diagnóstico terminado` → Gerente Operativo → bloque `Diagnósticos pendientes de validación`.
- `Validado` → CEO/Administrador → `Pendientes de cotizar` cuando el caso requiere precio.
- `Devuelto a corrección` → regresa al responsable técnico con motivo/instrucción visible.

Una devolución no borra el resultado previo; exige nueva terminación y nueva validación.

##### Diagnóstico externo / Maquila SYSTRON
`Diagnóstico → decisión de enviar a proveedor externo → Proveedor → movimiento físico de salida → trabajo externo → retorno/recepción → actualización Bitácora/resultado → terminación técnica → validación Gerente Operativo → salida comercial`.

Debe quedar relacionado con:
- Proveedor;
- Salida/retorno físico;
- Compra/O.C./CxP cuando exista obligación económica;
- Diagnóstico original.

El servicio externo no pausa el SLA.

##### Bitácora
En el detalle técnico debe existir la acción permitida para **agregar entrada de Bitácora**. Las entradas existentes son inmutables y muestran autor/fecha. La lectura respeta permisos; para MOT SYSTRON, SYSTRON la consulta en solo lectura.

##### Prioridad
La prioridad debe estar visible en listado/detalle y debe influir en el orden de las vistas técnicas junto con el vencimiento/SLA conforme a las reglas vigentes. El valor económico/SLA aplicable se congela cuando corresponde.

#### Reglas detalladas — Diagnóstico, Bitácora, Servicio Externo y prioridad

---

##### Prioridades

Diagnóstico utiliza:

- Normal.
- Alta.
- Exprés.

Cada empresa mantiene configuración independiente de precio, tiempo objetivo y SLA máximo.

Valores iniciales SYSTRON para Diagnóstico regular:

- Normal: $0, objetivo 5-10 días hábiles, máximo 10.
- Alta: $3,500, objetivo 2-5 días hábiles, máximo 5.
- Exprés: $4,500, máximo 1 día hábil.

Servomotores configura sus propios precios y SLA; un cambio en una empresa no afecta a la otra.

Los días hábiles actuales son lunes a viernes, sin calendario de festivos. Se conserva la hora de ingreso.

La prioridad/precio/SLA aplicable se congela al crear el Diagnóstico.

##### Inicio y estados

El SLA inicia con la confirmación de Ingreso físico por el área responsable.

Estados técnicos:

- En espera.
- En diagnóstico.
- Diagnóstico terminado.

##### Validación del Gerente Operativo

En SYSTRON, todo Diagnóstico terminado por Técnico/Supervisor pasa primero a:

`Pendiente validación Gerente Operativo`.

El Gerente Operativo puede:

- Validar.
- Devolver a Técnico para corrección.

Una devolución exige motivo/instrucción y conserva autor/fecha. El Diagnóstico debe volver a terminarse y ser validado.

La producción del Diagnóstico se atribuye a quien realizó el cierre técnico final que terminó siendo validado, no al Gerente Operativo.

En Servomotores, el Gerente Operativo es además el ejecutor técnico; su propia finalización cumple la función de validación operativa correspondiente.

##### Salida comercial

Una vez validado, el caso pasa al flujo común `Pendiente de cotizar` cuando deba determinarse un precio.

CEO/Administrador define el precio en SYSTRON.

En Servomotores, el Gerente Operativo puede preparar la Cotización de su operación conforme a sus atribuciones y CEO puede apoyar comercialmente.

Si un Diagnóstico cobrable no deriva en reparación autorizada, conserva su tratamiento de cobro/facturación. Diagnóstico Normal $0 puede habilitar Remisión $0.

##### Bonificación

Cuando un Diagnóstico cobrable fue pagado y posteriormente se autoriza una reparación, CEO/Administrador puede bonificar opcionalmente el cargo. La historia original permanece.

##### Diagnóstico externo SYSTRON

Si un proveedor externo realiza el diagnóstico:

- El Gerente Operativo captura el documento/cotización recibido.
- Esa captura no sustituye la validación: debe ejecutar la acción formal de validación como paso separado.
- Después pasa a `Pendiente de cotizar`.

---

La Bitácora Técnica registra:

- Comentarios/avances.
- Hallazgos.
- Pruebas.
- Incidencias.
- Resultados técnicos relevantes.

No contiene finanzas.

Cada entrada es inmutable:

- No se edita.
- No se elimina.
- Una corrección se registra como nueva entrada.
- Conserva autor y fecha/hora.

En SYSTRON la consultan Área Técnica y CEO/Administrador según permisos.

En una OS derivada de Diagnóstico, los antecedentes del Diagnóstico quedan visibles en modo lectura.

Para MOT originados en SYSTRON, la Bitácora registrada en Servomotores se refleja automáticamente en SYSTRON en modo solo lectura. El reflejo no concede permisos para editar la operación de Servomotores.

---

Servicio Externo es una ejecución contextual dentro de Diagnóstico u OS de SYSTRON.

Supervisor Técnico o Gerente Operativo puede asignar a Técnico interno o seleccionar Servicio Externo/Proveedor. Supervisor es el asignador principal.

Al salir a proveedor:

- Almacén registra Salida `Proveedor externo`.
- El equipo deja de estar físicamente en resguardo SYSTRON.
- Permanece visible como `En proveedor externo`.
- Se conserva proveedor, fecha y operación relacionada.

Al volver:

- Almacén registra `Retorno de proveedor`.
- Regresa a resguardo.
- Supervisor/Gerente Operativo resuelven continuidad.

La Salida genera documento físico con Equipo, folio, proveedor, operación, fecha/hora, motivo y responsable.

En Diagnóstico externo:

1. Proveedor revisa.
2. Gerente Operativo captura documento/cotización.
3. Gerente Operativo realiza la validación formal del Diagnóstico.
4. El caso pasa a `Pendiente de cotizar`.
5. CEO/Administrador define precio SYSTRON.
6. Vendedor da seguimiento.

Las obligaciones reales con el proveedor se reflejan mediante Compras/CxP conforme al flujo vigente. El costo de proveedor es independiente del precio SYSTRON.

Trabajo 100% externo no genera producción económica individual de Técnico/Supervisor. Trabajo mixto conserva participación pero no asigna valor económico individual por el componente externo.

---

Orden determinista:

1. Vencidos.
2. Entre no vencidos, el plazo más cercano.
3. En empate, la Entrada más antigua.

Una operación Normal cercana a vencimiento puede tener prioridad sobre una Alta recién ingresada.

---

---

### 4.4 Módulo Órdenes de Servicio y Reparación

---

#### Rutas

- Diagnóstico/Cotización autorizada → condiciones de ingreso cumplidas → OS.
- Atención `Reparación` preautorizada → Prioridad de Reparación → Ingreso físico → OS inmediata, aun sin precio final.
- Cotización preliminar autorizada sin equipo → **no crea OS** hasta alta/relación del equipo e Ingreso físico.

#### Campos clave

EQUI/MOT, origen, Prioridad de Reparación, SLA/porcentaje congelados, responsable técnico, estado y resultado.

#### Estados

`En espera → En reparación ↔ En espera de refacciones → Reparación terminada / Sin reparación`

`Solicitar refacciones` es acción, no estado.

La Reparación preautorizada puede terminar técnicamente antes de ser cotizada. Cuando el precio puede determinarse genera `Pendiente de cotizar`.

El folio de OS abre el detalle.

---


#### Recorrido operativo completo

##### Reparación posterior a Diagnóstico/Cotización
`Cotización autorizada + condiciones físicas cumplidas → OS/Reparación → En espera → asignación → En reparación ↔ En espera de refacciones → Reparación terminada / Sin reparación → documento/salida/administración pendiente según caso`.

##### Reparación preautorizada
`Atención Reparación → prioridad de Reparación → Ingreso físico → ejecución técnica inmediata → Reparación terminada o Sin reparación → Pendiente de cotizar cuando corresponda → CEO/Administrador fija precio → seguimiento comercial`.

No se debe detener artificialmente el trabajo técnico esperando precio si el tipo es preautorizado.

##### Refacciones
`OS necesita refacción → solicitud → existencia/compra → recepción parcial/total → surtido → OS`.

- Falta material necesario → `En espera de refacciones`.
- Surtido suficiente/completo para continuar → vuelve a estado operativo de Reparación.
- Las solicitudes y movimientos son navegables desde la OS.

##### Acciones por rol
- Técnico/Supervisor: ejecutar trabajo técnico conforme a asignación.
- Supervisor/Gerente Operativo SYSTRON: asignar/reasignar conforme a facultades.
- Gerente Operativo SYSTRON: no debe aparecer como ejecutor técnico normal.
- Gerente Operativo Servomotores: puede actuar como ejecutor técnico conforme a su rol híbrido.
- Reapertura terminal: solo roles autorizados, motivo obligatorio y sin consecuencias incompatibles.

##### Cierre
`Reparación terminada` es cierre técnico, no cierre administrativo. El detalle debe seguir mostrando pendientes de precio, Factura/Remisión, Pago o Salida física cuando existan.

#### Reglas detalladas

---

Estados técnicos:

- En espera.
- En reparación.
- En espera de refacciones.
- Reparación terminada.
- Sin reparación.

`Solicitar refacciones` es una acción, no un estado. Las pruebas se registran en Bitácora; no requieren un estado separado.

SYSTRON:

- Técnico opera trabajos propios.
- Supervisor asigna/reasigna, puede ejecutar y autoasignarse.
- Gerente Operativo asigna/reasigna y controla estados, pero no ejecuta trabajo.
- CEO/Administrador conservan facultades excepcionales definidas.

Servomotores:

- Gerente Operativo ejecuta y controla la operación técnica.

Si una solicitud de refacciones queda incompleta, la reparación pasa a `En espera de refacciones`; al quedar totalmente surtida vuelve a `En reparación`.

Una reparación técnicamente terminada no equivale necesariamente a cierre comercial/administrativo. El ciclo termina cuando se resuelven resultado técnico, entrega física, documentación fiscal/comercial, saldos y regularizaciones aplicables.

---

`Reparación` es el flujo para trabajos que el cliente ya autorizó ejecutar antes de conocer el precio final en SYGOS.

Tiene catálogo de prioridades propio, independiente del catálogo de Diagnóstico.

Valores iniciales de prioridad de Reparación:

- Normal: incremento 0%, objetivo 5-10 días hábiles, máximo 10.
- Alta: incremento 10%, objetivo 2-5 días hábiles, máximo 5.
- Exprés: incremento 20%, máximo 1 día hábil.

CEO/Administrador pueden configurar días e incremento. Cada Reparación conserva la fotografía de prioridad, porcentaje y SLA con la que nació.

Flujo:

1. Equipo/MOT y Atención `Reparación`.
2. Ingreso físico.
3. OS/operación técnica inmediata.
4. El trabajo puede avanzar hasta `Reparación terminada` o `Sin reparación` antes de existir precio.
5. Cuando el precio puede determinarse, aparece como `Reparación pendiente de cotizar`.
6. CEO/Administrador captura el precio base regular en SYSTRON; se aplica el incremento congelado de prioridad.
7. El documento para el cliente muestra únicamente el precio final, no el desglose base/incremento.

La reparación puede terminar técnicamente e incluso salir físicamente antes de quedar cotizada cuando la operación lo permita, pero permanece administrativamente pendiente hasta resolver Cotización, Factura/Remisión y saldos.

Si termina `Sin reparación`, CEO/Administrador decide cargo o no cargo; la prioridad no fuerza un cobro.

---

Orden determinista:

1. Vencidos.
2. Entre no vencidos, el plazo más cercano.
3. En empate, la Entrada más antigua.

Una operación Normal cercana a vencimiento puede tener prioridad sobre una Alta recién ingresada.

---

---

### 4.5 Garantías

---

La Garantía se maneja como proceso técnico relacionado con una reparación pagada previa.

Ruta:
1. localizar reparación original;
2. crear `Diagnóstico de Garantía`;
3. seleccionar prioridad aplicable;
4. confirmar recepción física;
5. ejecutar Diagnóstico/Bitácora;
6. resolver `Garantía válida` o `Garantía no procedente`;
7. continuar según decisión técnica/comercial.

El detalle debe mostrar y permitir abrir la reparación original y conservar la decisión técnica original.

---


#### Estados, acciones y handoffs de Garantía

Ruta común:

`Reparación pagada original vigente → nueva Atención Diagnóstico de Garantía → Ingreso físico → Diagnóstico/Bitácora → decisión técnica → Garantía válida o Garantía no procedente`.

##### SYSTRON
- `Diagnóstico terminado` → Gerente Operativo SYSTRON valida y determina procedencia.
- `Garantía válida` → Reparación en garantía → terminación → Remisión $0 cuando corresponda → Salida.
- `Garantía no procedente` → CEO/Administrador recibe pendiente comercial.
- CEO/Administrador puede:
  - enviar a Cotización normal; o
  - aceptar comercialmente como Garantía válida, siempre que no existan consecuencias incompatibles.

##### MOT SYSTRON atendido por Servomotores
- Servomotores ejecuta Diagnóstico de Garantía.
- Decisión `Garantía válida` del Gerente Operativo Servomotores se refleja automáticamente en SYSTRON y continúa sin segunda aprobación técnica.
- `Garantía no procedente` se refleja en SYSTRON y pasa al CEO para decisión comercial.
- La decisión técnica original permanece visible aunque exista override comercial.

##### Cliente directo Servomotores
Sigue la misma separación entre decisión técnica del Gerente Operativo y posible override comercial del CEO.

El detalle de Garantía debe abrir:
- reparación pagada original;
- EQUI/MOT;
- Diagnóstico de Garantía;
- reparación en garantía si existe;
- Remisión/Salida;
- relaciones intercompañía cuando corresponda.

#### Reglas detalladas

---

La garantía se origina en una reparación pagada previa y se evalúa mediante una nueva Atención `Diagnóstico de Garantía`.

##### Vigencia

- 6 meses exactos desde la salida física de la reparación pagada original.
- Una atención de Garantía no reinicia el periodo.
- Puede haber varios reclamos dentro del mismo periodo.
- Una nueva reparación pagada crea un nuevo periodo.

##### Flujo SYSTRON

1. Se crea `Diagnóstico de Garantía`.
2. Se confirma Entrada física.
3. Se ejecuta Diagnóstico y Bitácora.
4. Pasa a validación del Gerente Operativo.
5. Gerente Operativo determina:
   - `Garantía válida`.
   - `Garantía no procedente`.

Si es válida:

- Continúa como reparación de garantía.
- No genera nuevo cobro si se resuelve satisfactoriamente.
- Usa Remisión $0 cuando corresponda.
- Se conserva relación con la reparación original.

Si no procede:

- Pasa a decisión comercial de CEO/Administrador.
- Puede cotizarse como reparación normal.
- CEO/Administrador puede cambiarla a `Garantía válida` por decisión comercial mientras no existan consecuencias posteriores incompatibles.
- La determinación técnica original queda en historial.

##### MOT SYSTRON atendido por Servomotores

SYSTRON crea Diagnóstico de Garantía y Servomotores confirma Ingreso.

Gerente Operativo de Servomotores diagnostica:

- Si determina `Garantía válida`, SYSTRON recibe automáticamente ese resultado; no requiere segunda aprobación del CEO.
- Si determina `Garantía no procedente`, el caso aparece al CEO de SYSTRON para decidir entre cotizar reparación o aceptar comercialmente la garantía.

##### Cliente directo Servomotores

Aplica la misma lógica: Gerente Operativo determina procedencia y CEO puede convertir una no procedente en válida por decisión comercial cuando todavía sea compatible con el estado del caso.

---

---

## 5. Área Custodia e Inventario

---

### 5.1 Módulo Custodia física

---

La custodia representa dónde se encuentra físicamente el equipo y no sustituye el estado técnico.

#### SYSTRON
EQUI creado → Entrada por Almacén → En resguardo → Salida/Salida a prueba/Proveedor según operación.

#### Servomotores
MOT pendiente → Ingreso por Gerente Operativo → En resguardo → Egreso/Salida a prueba.

Una salida definitiva debe relacionarse con el documento habilitante aplicable.

El historial físico debe ser navegable desde el EQUI/MOT.

---


#### Acciones y recorridos por movimiento

##### Entrada / Ingreso
Debe capturar/confirmar EQUI/MOT, motivo, fecha/hora y usuario. Al confirmarse cambia custodia y, cuando la regla del proceso lo establece, inicia SLA.

##### Salida a prueba
`Equipo en resguardo/operación → Salida a prueba → receptor/contexto → fuera a prueba`.

No cierra el proceso técnico. Si regresa, se registra retorno real. Si no regresa porque queda funcionando/entregado bajo una consecuencia válida, no se crea retorno ficticio; se continúa con el cierre/documento que corresponda.

##### Salida a proveedor externo
Debe quedar vinculada a Diagnóstico/OS, Proveedor y posterior retorno cuando ocurra.

##### Salida/Egreso definitivo
Requiere Factura o Remisión habilitante cuando aplique. Debe conservar modalidad de entrega, receptor/destinatario y evidencia/datos operativos definidos.

El detalle del movimiento debe abrir EQUI/MOT, operación origen y documento habilitante.

#### Reglas detalladas

---

##### Almacén SYSTRON

Mantiene:

- Entradas.
- En resguardo.
- Salidas.

Motivos incluyen Diagnóstico, Reparación, Diagnóstico de Garantía, Venta de equipo, Retorno de proveedor y Salida a prueba cuando corresponda.

Los MOT originados en SYSTRON y trabajados por Servomotores **no pasan por Almacén SYSTRON**.

##### Salida a prueba

Es un movimiento físico temporal.

- No cierra el proceso técnico/comercial.
- No cambia artificialmente el estado operativo.
- Si el equipo vuelve, se registra nueva Entrada/retorno.
- Si funciona y permanece con el destinatario, no se obliga a simular un retorno; la cadena física debe mostrar que salió a prueba y permaneció fuera.

##### Servomotores

El Gerente Operativo opera vistas:

- `Ingresos`.
- `En resguardo`.
- `Egresos`.

Ingreso confirma custodia física, inicia SLA y activa el servicio ya seleccionado.

En resguardo representa custodia actual.

Egreso confirma que Servomotores ya no posee físicamente el MOT.

##### Egreso definitivo

Requiere Factura o Remisión habilitante cuando corresponda.

Registra al menos:

- Cliente administrativo.
- MOT.
- Documento habilitante.
- Fecha/hora.
- Modalidad de entrega.
- Persona que recibe físicamente.
- Contacto si aplica.
- Observaciones.
- Usuario que registra.

La persona que recibe no se convierte en Cliente.

Para un MOT originado en SYSTRON, Servomotores puede entregar directamente al destinatario final indicado; no requiere pasar por Almacén SYSTRON. El cliente administrativo de Servomotores sigue siendo `SYSTRON`.

##### Correcciones e historia

Los movimientos físicos conservan autor/fecha y motivo de corrección/cancelación cuando aplique.

Si una Entrada ya generó actividad técnica, no puede cancelarse de forma simple sin resolver la consecuencia técnica.

---

---

### 5.2 Módulo Refacciones e Inventario

---

Solicitudes de Refacción nacen desde OS.

Ruta:
OS → Solicitar refacción → cantidad/número de parte/descripción/link opcional → recepción parcial/total → surtido → actualización del estado técnico.

Inventario muestra número de parte, descripción, existencia y mínimos/máximos informativos.

Inventario Servomotores inicia deshabilitado y separado del de SYSTRON.

---


#### Recorrido de Solicitud de Refacción

`OS/Reparación → Solicitar refacción → validar existencia → surtido inmediato o Compra/O.C. → recepción parcial/total → entrada a Inventario cuando corresponda → surtido a OS → actualización de estado técnico`.

El detalle de Solicitud debe mostrar:
- OS/Reparación origen;
- Parte/Refacción;
- cantidad solicitada;
- cantidad recibida/surtida/pendiente;
- Compra/O.C. relacionada cuando exista;
- estado.

Inventario físico/importación debe permitir comparar contra existencia vigente antes de confirmar diferencias. No debe inventar reservas, ubicaciones ni costeo no definidos.

#### Reglas detalladas

---

##### Solicitudes desde OS

Una OS puede solicitar cualquier número de refacciones.

Campos:

- Cantidad.
- Número de parte.
- Descripción.
- Link opcional.

Estados:

- Solicitada.
- En tránsito.
- En almacén.
- Surtida.

Se permite surtido parcial.

Una solicitud incompleta fuerza `En espera de refacciones`; al completarse vuelve a `En reparación`.

##### Inventario SYSTRON

- Número de parte único dentro de la empresa.
- Unidad actual: piezas.
- Sin reservas.
- Sin ubicaciones internas.
- Sin costeo de inventario.
- Excedentes pueden entrar a stock.
- Material nuevo capturado se incorpora al recibirse físicamente.
- Cada refacción puede tener `mínimo` y `máximo` informativos.
- Mínimo/máximo no compra, reserva ni bloquea automáticamente.

Inventario físico:

- Exportar.
- Importar conteo.
- Previsualizar diferencias antes de aplicar.

##### Inventario Servomotores

Es independiente de SYSTRON y no comparte existencias.

Inicialmente queda **deshabilitado**.

Solo Administrador puede habilitar la capacidad para Servomotores.

Al habilitarse:

- Inicia vacío.
- Maneja catálogo/existencias propios.
- Puede utilizar mínimos/máximos informativos y reglas de movimientos equivalentes.
- No copia automáticamente inventario de SYSTRON.

Mientras esté deshabilitado, las operaciones de Servomotores pueden avanzar sin exigir control de stock interno.

---

---

## 6. Área Compras y Proveedores

---

### 6.1 Módulo Proveedores

---

Alta directa o alta rápida desde Compra/O.C., CxP o Servicio Externo cuando el rol tenga permiso.

El nombre/razón social abre detalle.

Relaciones existentes: Compras/O.C., CxP y Servicio Externo.

---


#### Ruta, campos y ciclo

Alta directa o alta rápida desde Compra/O.C./CxP/Servicio Externo.

Campos mínimos al crear:
- Nombre/Razón social.
- Datos de contacto disponibles.

Datos fiscales, crédito u otros campos se vuelven obligatorios únicamente cuando el proceso posterior realmente los necesite.

El nombre abre detalle con Compras/O.C., CxP y Servicios Externos existentes.

Proveedor con historia no se elimina para perder relaciones; puede inactivarse cuando deje de utilizarse.

#### Reglas detalladas

---

Cada empresa mantiene su propio catálogo de Proveedores.

En SYSTRON existe un Proveedor intercompañía fijo `Servomotores` para las obligaciones derivadas de operaciones entre ambas empresas.

Campos principales:

- Nombre/Razón social.
- Contacto.
- Teléfono/correo opcionales.
- Datos fiscales opcionales.
- Días de crédito.
- `Emite factura fiscal`: Sí/No.
- Tipo/categoría cuando corresponda.
- Estado activo/inactivo.

Pueden crear/editar:

- Gerente Operativo de la empresa cuando su función lo requiera.
- Coordinación.
- CEO.
- Administrador.

Si tiene historia no se elimina; se inactiva para nuevas operaciones.

El detalle navega a Compras, O.C., CxP y Servicio Externo cuando aplique.

---

---

### 6.2 Módulo Compras

---

#### Compra directa

1. seleccionar/crear Proveedor;
2. capturar concepto, destino e importe;
3. comprobar límite individual y bolsa mensual;
4. registrar;
5. Coordinación valida/cuadra;
6. procesar a **exactamente un Egreso o una CxP**;
7. permanecer en detalle.

#### Orden de Compra

1. capturar solicitud;
2. Proveedor si ya se conoce;
3. conceptos/cantidades/destino;
4. importe estimado;
5. solicitar autorización;
6. CEO autoriza/rechaza;
7. O.C. autorizada aparece a Coordinación;
8. Coordinación procesa a **exactamente un Egreso o una CxP**;
9. O.C. queda Procesada.

El folio O.C. abre detalle.

Cambio material posterior a autorización devuelve la O.C. a autorización de CEO.

---


#### Estados, responsables y bandejas

##### Compra directa
`Registrada → Pendiente de validar/cuadrar → Procesada`.

- Registro válido dentro de límites consume bolsa mensual inmediatamente.
- Coordinación recibe `Compras directas pendientes de validar`.
- Coordinación puede cuadrar/editar antes del procesamiento.
- Si la edición rompe límites, la compra ya no puede avanzar como directa y debe convertirse/replantearse por O.C. según el flujo definido.
- Al procesarse queda ligada exactamente a 1 Egreso o 1 CxP.

##### Orden de Compra
`Pendiente de autorización → Autorizada / Rechazada → Pendiente de procesar → Procesada`, con `Cancelada` como estado terminal permitido.

Handoffs:
- Creada por Gerente/Coordinación → CEO → `O.C. pendientes de autorización`.
- Autorizada → Coordinación → `O.C. autorizadas pendientes de procesar`.
- Cambio material posterior → vuelve a CEO y conserva versión autorizada previa.
- Procesada → deja bandejas activas y mantiene relación financiera.

El detalle de Compra/O.C. debe abrir Proveedor, destino (OS/MOT/Inventario), solicitante y Egreso/CxP final.

#### Reglas detalladas

---

Existe módulo `Compras` independiente por empresa.

Acceso funcional:

- Gerente Operativo de la empresa.
- Coordinación de Administración.
- CEO.
- Administrador.

Concentra compras de refacciones, inventario cuando esté habilitado, herramientas, materiales, servicios operativos y otros destinos aprobados.

##### Compra directa del Gerente Operativo

Cada Gerente Operativo tiene en su ficha:

- Presupuesto mensual de compra directa, default `$5,000 MXN`.
- Máximo por compra directa, default `$2,000 MXN`.

Ambos son configurables por autorizado y aplican por mes calendario.

Una compra puede registrarse sin O.C. solo si cumple simultáneamente:

1. La compra individual no supera su máximo por compra.
2. El acumulado de compras directas del mes, incluyendo la nueva, no supera su presupuesto mensual.

El saldo no usado no se acumula al siguiente mes.

El importe consume presupuesto desde el registro para impedir que compras pendientes evadan el límite.

##### Validación de compra directa

Coordinación revisa/cuadra la compra.

Puede editar o eliminar el registro antes de quedar procesado financieramente.

- Si modifica importe, se recalcula el presupuesto consumido.
- Si elimina, se libera el importe.
- Si una edición provoca rebasar el límite individual o mensual, ya no puede continuar como compra directa: debe pasar al flujo de O.C.

Una compra directa validada termina vinculada exactamente a:

- 1 Egreso, si es contado/pago inmediato.
- 1 CxP, si es a crédito.

Una vez procesada financieramente no se elimina silenciosamente; correcciones se realizan mediante las reglas del movimiento financiero relacionado.

##### Orden de Compra

En SYGOS la O.C. es una **solicitud interna autorizada de compra**, no un compromiso formal con un proveedor.

Se usa cuando:

- La compra rebasa el máximo individual.
- Rebasaría el presupuesto mensual.
- Por su naturaleza requiere autorización expresa.
- El Gerente decide solicitar autorización aun estando dentro de límites.

Las O.C. autorizadas no consumen la bolsa mensual de compra directa.

##### Creación y autorización

Pueden generar O.C.:

- Gerente Operativo.
- Coordinación.
- CEO.
- Administrador conforme a sus facultades.

CEO es el **único autorizador** de una O.C.

Si CEO crea directamente la O.C., queda autorizada desde su creación.

Flujo principal:

- Solicitud.
- Pendiente de autorización.
- Autorizada.
- Pendiente de procesar.
- Procesada.

También puede quedar:

- Rechazada.
- Cancelada.

Coordinación debe ver claramente las O.C. autorizadas pendientes de procesar.

##### Cambios después de autorización

Coordinación puede completar datos de ejecución sin nueva aprobación si no altera lo autorizado.

Cambios materiales - proveedor, importe, cantidades, conceptos o condiciones económicas relevantes - regresan a `Pendiente de autorización` y requieren nuevamente CEO.

Se conserva la versión previamente autorizada.

##### Procesamiento financiero

Una O.C. autorizada no genera por sí sola deuda ni salida de dinero.

Al ejecutarse:

- Contado/pago inmediato -> se vincula a 1 Egreso.
- Crédito -> se vincula a 1 CxP.

Cada O.C. termina en exactamente un Egreso o una CxP. Si una necesidad se divide entre varios proveedores/movimientos deben existir O.C. separadas.

Una vez vinculada queda `Procesada`. Si la CxP se paga después, sigue el ciclo normal de CxP sin reabrir la O.C.

##### Cancelación

Una O.C. autorizada puede ser cancelada por:

- CEO.
- Coordinación.

Requiere motivo e historial. No genera Egreso/CxP.

##### Datos y destino

Compra/O.C. puede indicar:

- Proveedor, cuando se conoce.
- Concepto/material/servicio.
- Cantidad cuando aplique.
- Importe estimado/autorizado.
- Destino: OS, MOT, Inventario, gasto operativo u otro origen permitido.
- Referencias de envío/paquetería cuando aplique.

El importe real queda en el Egreso/CxP. La diferencia contra lo autorizado no debe ocultarse.

---

---

## 7. Área Facturación y Cobranza

---

### 7.1 Módulo Facturación

---

Factura, Remisión y Factura libre pertenecen a este módulo.

#### Flujo normal
Solicitud operativa → pendiente para Coordinación → validación de datos necesarios → emisión/generación → detalle del documento → relación navegable con la operación origen.

El folio del documento abre su detalle.

Factura/Remisión deben permitir abrir Cliente y operación origen cuando el usuario tenga permiso.

---


#### Rutas operativas separadas

##### Solicitud y emisión de Factura
`Operación cobrable → Solicitar Factura → Coordinación recibe pendiente → validar datos fiscales/importe/saldo → emitir → Factura → CxC/vencimiento → habilitaciones posteriores`.

Puede facturarse total o parcialmente sin exceder saldo permitido.

##### Remisión
`Operación elegible → solicitar Remisión → Coordinación recibe pendiente → genera Remisión → documento queda relacionado → habilita Salida física cuando corresponda`.

El Vendedor/Gerente Operativo solicita; no genera directamente.

##### Factura libre
`Facturación → Nueva Factura libre → Cliente existente → conceptos → IVA/descuento/datos fiscales → emitir → CxC/Pagos`.

No crea OS, Diagnóstico, Venta ni EQUI/MOT artificiales.

##### Cancelación fiscal
`Factura emitida → solicitar/autorizar cancelación → CEO/Administrador aprueba → Coordinación ejecuta → resultado fiscal/historial`.

##### Nota de crédito
`Documento elegible → Coordinación prepara → CEO/Administrador aprueba → Coordinación emite`.

##### Intercompañía
`Servomotores emite Factura a SYSTRON → CxC Servomotores + CxP SYSTRON + vínculo MOT → Pago real posterior`.

La emisión intercompañía no depende del cierre técnico ni de la Factura al cliente final.

##### Errores
Un error del proveedor fiscal deja el mismo registro en estado recuperable. Reintentar no debe crear un segundo CFDI cuando el proveedor ya haya procesado el primero.

#### Reglas detalladas — Facturación, Remisiones y Factura libre

---

Facturapi es el proveedor fiscal de referencia cuando esté configurado.

Cada empresa factura con su propia identidad fiscal y configuración.

##### Origen

Una Factura puede nacer desde:

- Diagnóstico.
- OS/Reparación.
- Servicio en campo.
- Venta de equipo.
- Factura libre.
- Operación intercompañía.

##### Solicitud y emisión

Vendedor SYSTRON o Gerente Operativo Servomotores, según su operación, pueden solicitar Factura.

Coordinación genera/emite desde la empresa activa.

Coordinación también puede iniciar facturación sin solicitud cuando una operación abierta exige factura.

Por defecto se propone el saldo/importe pendiente permitido y se admite facturación parcial. Se previene sobrefacturación.

##### PO y referencia comercial

PO del Cliente es opcional. Si falta puede advertirse sin bloquear.

La `Información complementaria / Referencia comercial` de la Cotización se hereda cuando corresponda.

##### Datos fiscales y crédito

Se usan datos fiscales vigentes al emitir y se congela su fotografía histórica.

Vencimiento = fecha de emisión + días de crédito congelados.

##### Intercompañía Servomotores -> SYSTRON

Servomotores puede facturar a SYSTRON en el momento administrativamente apropiado; no depende de terminación técnica, entrega física ni facturación del cliente final.

La Factura intercompañía:

- Genera CxC en Servomotores contra Cliente `SYSTRON`.
- Genera/relaciona CxP en SYSTRON contra Proveedor `Servomotores`.
- Conserva vínculo con MOT/operación intercompañía.
- No duplica el flujo de dinero.

##### Cancelación/notas/fallos

Cancelación fiscal requiere autorización CEO/Administrador; Coordinación ejecuta.

Nota de crédito: Coordinación prepara, CEO/Administrador aprueba, Coordinación emite.

Ante fallo de Facturapi:

- No duplicar.
- Mostrar pendiente/error entendible.
- Permitir reintento desde el mismo registro.
- Confirmar antes de crear otro documento si el proveedor pudo haber procesado la operación.

---

La Remisión habilita salida física cuando una Factura no es el documento habilitante aplicable.

Casos incluyen:

- Diagnóstico sin cargo.
- Sin reparación sin cargo.
- Garantía terminada.
- Operación que aún no puede facturarse.
- Cliente que no requiere Factura.
- Salida física permitida antes de facturación.

Puede existir Remisión $0.

El Vendedor **no genera** Remisiones.

Flujo:

- Vendedor SYSTRON o Gerente Operativo Servomotores solicita Remisión.
- Coordinación de Administración genera la Remisión desde la empresa activa.
- CEO/Administrador conservan facultades equivalentes.

Si el Cliente requiere factura, la Remisión permite la salida cuando corresponda pero no elimina la obligación fiscal pendiente.

---

Vive dentro de Facturación de cada empresa.

Pueden emitir:

- Coordinación.
- CEO.
- Administrador.

Parte de un Cliente existente, puede tener varias partidas, MXN, IVA y descuentos aplicables, usa Facturapi, puede generar CxC y recibir Pagos.

No genera artificialmente OS, Diagnóstico, Venta, EQUI/MOT u otra entidad operativa.

Se identifica con origen `Factura libre`.

No genera comisiones ni conversión/metas comerciales, pero sí impacta finanzas, CxC, Cobranza y Pagos de la empresa activa.

---

---

### 7.2 Módulo Pagos

---

Registrar Pago exige comprobante, importe y destino; distribución cuando aplique.

Nace `Pendiente de validación`. Solo al validarse reduce saldos e impacta ingreso.

El identificador/folio abre detalle y permite navegar a Cliente, Facturas/CxC y destino financiero.

---


#### Estados y acciones

`Pendiente de validación → Validado`.

Al registrar:
1. seleccionar Cliente;
2. adjuntar comprobante;
3. capturar importe;
4. seleccionar destino financiero;
5. distribuir entre documentos/saldos cuando corresponda;
6. guardar pendiente.

Coordinación valida. Solo entonces:
- impacta Finanzas;
- reduce CxC;
- cambia saldos.

##### Efectivo
- Recibido por Vendedor: pendiente hasta entrega física completa a Coordinación.
- Recibido directamente por Coordinación/CEO/Administrador: puede quedar confirmado conforme a la regla vigente.
- Aplican límites de efectivo definidos para Facturas.

##### Crédito anticipado
Si aún no existe documento al cual aplicar, queda como crédito del Cliente. Coordinación lo aplica posteriormente mediante acción explícita.

##### Regularización
Un Pago ya validado no se elimina para corregir una aplicación posterior; se regulariza conservando el movimiento real.

#### Reglas detalladas

---

Los Pagos pertenecen a una empresa y nunca mezclan saldos de ambas.

Requieren comprobante, importe total, destino financiero y distribución cuando aplique. Un comprobante corresponde a un Pago para prevenir duplicados.

Un Pago registrado por operación queda pendiente de validación de Coordinación. Solo validado se considera ingreso y reduce saldos.

Puede existir crédito anticipado del Cliente; Coordinación decide posteriormente su aplicación y no se aplica automáticamente.

Efectivo recibido por Vendedor permanece pendiente hasta entrega física completa a Coordinación. Si Coordinación/CEO/Administrador recibe directamente, puede registrarlo confirmado.

Política SYSTRON vigente para Facturas de clientes que requieren factura:

- Menor a $2,000 MXN puede aceptar efectivo.
- $2,000 MXN o más bloquea aplicación de efectivo, incluso fraccionada.

##### Pago intercompañía

El pago SYSTRON -> Servomotores es un pago real:

- Sale de una cuenta de SYSTRON.
- Entra a una cuenta de Servomotores.
- Se relaciona con Factura/CxP/CxC y MOT correspondiente.
- Puede ser parcial.

No existe compensación ficticia para evitar registrar el flujo real.

---

---

### 7.3 Módulo Cuentas por cobrar y Cobranza

---

CxC debe poder encontrarse por Cliente, documento, saldo y vencimiento.

El detalle muestra documento origen, vencimiento, saldo, Pagos aplicados y seguimiento.

Las relaciones a Cliente/Factura/Pagos existentes son navegables.

---


#### Operación de Cobranza

Estados de saldo:
`Abierta → Parcial → Saldada`; `Vencida` es una condición calculada cuando existe saldo después de vencimiento.

El detalle de CxC debe permitir:
- abrir Cliente y Factura/origen;
- ver Pagos aplicados;
- registrar nota/promesa/próximo seguimiento;
- consultar saldo/vencimiento.

El Panel de Ventas debe mostrar la cartera propia del Vendedor y navegar a estas entidades. Registrar próximo seguimiento no crea una tarea/recordatorio automático.

#### Reglas detalladas

---

CxC y Cobranza son independientes por empresa.

Vendedor SYSTRON consulta `Mi cobranza` de sus clientes. Gerente Operativo Servomotores consulta la cobranza comercial que le corresponda. Coordinación, CEO y Administrador consultan la empresa activa.

`Vencida` significa saldo pendiente posterior a la fecha de vencimiento.

Orden inicial: mayor número de días vencidos.

Puede registrarse log de cobranza con autor, fecha, nota, promesa y próximo seguimiento, sin crear automáticamente tareas/recordatorios.

Solo Pagos validados reducen saldos.

Las CxC intercompañía de Servomotores contra SYSTRON son parte de la cobranza de Servomotores y no se mezclan con la CxC de SYSTRON.

---

---

## 8. Área Finanzas

---

### 8.1 Módulo Finanzas

---

Incluye Bancos, Efectivo, Tarjetas, Ingresos, Egresos, Movimientos y categorías.

Cada movimiento debe identificar su origen funcional cuando exista.

El Dashboard financiero es una **vista** del módulo; cada KPI navega a su listado origen.

No existe consolidación entre empresas.

---


#### Rutas de movimiento

Cada movimiento financiero debe conservar su **origen** cuando exista:

- Pago validado → Ingreso.
- Compra directa/O.C. de contado → Egreso.
- CxP pagada → Egreso.
- Nómina autorizada → movimientos correspondientes.
- Transferencia → movimiento entre cuentas válidas de la misma empresa.
- Movimiento manual → captura autorizada con categoría/contraparte.

El detalle del movimiento abre su origen. Los movimientos confirmados no se corrigen mediante eliminación silenciosa.

##### Servomotores — utilidad/distribución pendiente de comprobación
Cuando existe un pago real previo a la Factura/comprobante correspondiente, debe permanecer identificado como pendiente de comprobación y regularizarse después sin crear un segundo movimiento financiero.

#### Reglas detalladas

---

Cada empresa tiene módulo financiero completo e independiente.

Incluye:

- Bancos.
- Efectivo.
- Tarjetas.
- Ingresos.
- Egresos.
- Movimientos.
- CxC.
- CxP.
- Cobranza.
- Dashboard financiero.
- Categorías propias.

No se mezclan cuentas, saldos ni movimientos entre empresas.

CEO, Administrador y Coordinación cambian de empresa para trabajar sus finanzas. No existe consolidado.

Las transferencias internas solo aplican banco <-> banco dentro de la misma empresa y no son ingreso/gasto.

Tarjetas mantienen deuda separada; cargos no reducen banco hasta su pago.

Ingresos/Egresos manuales pueden registrarlos Coordinación, CEO y Administrador conforme a permisos.

Movimientos muestra solo efectos financieros confirmados y navega al origen.

##### Utilidades/distribuciones del Gerente Operativo de Servomotores

Las distribuciones de utilidades o conceptos equivalentes del Gerente Operativo de Servomotores no forman parte de Nómina.

Se documentan mediante factura emitida por él.

- Si la factura existe antes o al pagar: flujo normal de CxP y pago.
- Si se paga antes de recibir factura: se registra como pago/egreso pendiente de comprobación/factura.
- Al recibirse posteriormente la factura se adjunta/relaciona para regularizar.
- No se genera una segunda salida de dinero.

Coordinación debe poder identificar claramente estos pendientes de comprobación dentro de Servomotores.

---

Existe un Dashboard financiero **por empresa activa**.

Acceso:

- CEO.
- Administrador.
- Coordinación.

No existe dashboard ni resumen financiero consolidado SYSTRON + Servomotores.

Filtros:

- Mes.
- Trimestre.

Indicadores principales:

- Facturado.
- Cobrado.
- Egresos.
- Utilidad gerencial sobre facturación.
- Flujo neto.

Posición actual:

- Saldos de cuentas.
- CxC.
- CxP.
- Deuda de tarjetas.

Puede mostrar tendencia de 12 meses y comparación con periodo anterior.

Cada KPI navega al listado de origen dentro de la misma empresa.

---

---

### 8.2 Cuentas por Pagar

---

CxP tiene ciclo propio dentro de Finanzas.

Nace desde Compra/O.C. a crédito, obligación administrativa o Factura intercompañía.

Detalle: Proveedor, origen, importe, vencimiento, saldo y Pagos.

Una O.C. solamente autorizada **no** crea CxP hasta que realmente exista la obligación a crédito.

---


#### Ciclo operativo

`CxP abierta → pago parcial o total → parcial/pagada`.

CxP puede nacer desde Compra/O.C. a crédito, obligación permitida o Factura intercompañía.

El detalle muestra Proveedor, origen, importe, vencimiento, saldo y Egresos/pagos aplicados.

Cuando falta comprobante fiscal pero el dinero ya salió conforme a un flujo válido, la regularización posterior adjunta/relaciona el comprobante sin duplicar Egreso ni CxP.

#### Reglas detalladas

---

CxP pertenece a una empresa.

Campos funcionales incluyen Proveedor, descripción, monto, fecha, vencimiento, pagado, saldo y relación navegable con origen cuando exista.

Días de crédito se heredan del Proveedor salvo regla específica posterior.

Pueden crear/gestionar:

- Coordinación.
- CEO.
- Administrador.

Los pagos pueden ser parciales.

Una Compra/O.C. a crédito genera o se vincula exactamente a una CxP.

La Factura intercompañía de Servomotores genera/relaciona CxP en SYSTRON contra Proveedor `Servomotores`.

Un pago anticipado pendiente de comprobación de Servomotores se regulariza contra la factura posterior sin duplicar egreso.

---

---

## 9. Área Personal y Nómina

---

### 9.1 Módulo Personal / RRHH

---

Colaborador es la entidad principal.

No admite alta rápida.

El nombre del Colaborador abre detalle con información laboral, jefe, salario según permisos, documentos, Asistencia, Vacaciones, Horas extra y Nóminas existentes.

Vacaciones, documentos laborales y Asistencia/Kiosco son procesos/capacidades dentro de Personal.

---


#### Ciclo de Colaborador

`Alta → Activo → cambios laborales permitidos → Baja`.

Alta:
1. empresa;
2. tipo Nuevo/Migrado;
3. datos laborales;
4. fecha de ingreso;
5. jefe directo salvo CEO;
6. componentes salariales aplicables;
7. saldo inicial de Vacaciones cuando sea Migrado;
8. creación/relación de usuario ERP conforme a rol;
9. abrir detalle.

Baja conserva historia y deshabilita acceso.

Cambios de jefe y salario conservan historia porque afectan responsabilidades y dinero.

#### Recorrido de Vacaciones

`Jefe directo registra solicitud para subordinado → Pendiente de validación → CEO/Administrador valida → Autorizada o Rechazada`.

Si CEO/Administrador es el jefe directo, su acción resuelve la autorización.

Al autorizar:
- solo lunes-viernes consumen saldo;
- los días se reflejan en Asistencia como Vacaciones;
- no generan ausencia/retardo;
- generan automáticamente Prima vacacional del 25%;
- la prima se divide entre semanas de Nómina según días efectivamente tomados;
- la composición timbrado/efectivo se conserva proporcionalmente.

La Vacación y su Prima deben ser navegables desde el detalle del Colaborador y desde la Nómina que las pagó.

#### Recorrido de Asistencia/Kiosco

`Horario vigente → Entrada → Salida → clasificación diaria`.

Resultados posibles:
- Normal;
- Retardo;
- Ausencia;
- Vacaciones;
- Permiso;
- Salida faltante.

`Salida faltante` no produce automáticamente descuento.

Correcciones:
- Coordinación puede crear faltantes manuales por contingencia con motivo.
- CEO/Administrador puede corregir registros existentes con motivo/historial.

Los cambios de horario no recalculan periodos anteriores.

#### Excepción Servomotores
Gerente Operativo Servomotores no debe recibir acciones, paneles ni cálculos de Asistencia, Vacaciones, Horas extra, Prima vacacional, Aguinaldo o Bonos. Ayudante General sí sigue el recorrido ordinario.

#### Reglas detalladas — Personal, Vacaciones, documentos y Asistencia

---

Personal se administra por empresa. Cada empresa tiene sus propios colaboradores y Nómina.

Acceso completo:

- CEO.
- Administrador.
- Coordinación.

##### Colaboradores

Un colaborador activo corresponde a un usuario ERP, aunque el rol pueda no tener panel operativo, como `Ayudante General`.

Tipos de alta:

- Nuevo.
- Migrado.

Migrado admite fecha original de ingreso y saldo inicial de vacaciones.

Baja deshabilita acceso y conserva historia.

##### Jefe directo

Obligatorio excepto CEO.

Solo CEO/Administrador asigna/cambia jefe y se conserva historia.

Servomotores:

- Gerente Operativo -> jefe CEO.
- Ayudante General -> jefe Gerente Operativo.

##### Salarios

Puede existir:

- Salario diario timbrado.
- Salario diario en efectivo.

Solo CEO/Administrador modifica importes y se conserva historial.

Regla ordinaria: Nómina semanal de 7 días; asistencia regular lunes-viernes, descansos pagados sábado/domingo.

Ausencias/permisos sin goce mantienen la lógica de descuento `días x 7/6` sobre componentes aplicables.

##### Excepción Gerente Operativo Servomotores

Su Nómina incluye únicamente salario fijo.

No aplica:

- Kiosco/asistencia.
- Horario.
- Retardos/faltas.
- Horas extra.
- Vacaciones.
- Prima vacacional.
- Aguinaldo.
- Bonos.
- Otros beneficios/conceptos ordinarios adicionales.

Distribuciones de utilidades no se manejan por Nómina; siguen el flujo financiero/fiscal definido.

##### Ayudante General Servomotores

Usa las reglas laborales ordinarias:

- Asistencia/Kiosco.
- Vacaciones.
- Prima vacacional.
- Horas extra.
- Nómina semanal.
- Documentos/timbrado.
- Bonos/beneficios cuando estén configurados y correspondan.

---

Las vacaciones aplican a colaboradores ordinarios según antigüedad y reglas legales configuradas/aplicables. Gerente Operativo de Servomotores está excluido por su regla especial.

El empleado no solicita Vacaciones.

Flujo:

1. Jefe directo solicita/registra las fechas para su subordinado.
2. CEO/Administrador valida.
3. Si CEO/Administrador es el jefe directo, la solicitud queda autorizada con su propia acción.

Solo lunes a viernes consumen saldo.

Vacaciones:

- Pagan Nómina normal.
- No cuentan como inasistencia.
- No afectan bono de puntualidad.

CEO/Administrador puede ajustar saldo con motivo e historial.

##### Prima vacacional

Una Vacación autorizada genera automáticamente prima vacacional de 25% del salario diario total por los días efectivamente tomados.

Salario diario total = componente timbrado + componente efectivo.

La prima se distribuye proporcionalmente entre ambos componentes según la composición salarial.

Se paga en la Nómina de la semana en la que se toman los días.

Si las vacaciones abarcan varias semanas de Nómina, la prima se divide según los días de Vacaciones de cada semana.

Los documentos de Nómina identifican la prima vacacional.

No se captura manualmente como `Ingreso extra`.

---

Coordinación, CEO y Administrador pueden gestionar documentos laborales necesarios.

Para documentos generales:

- Subir.
- Reemplazar.
- Eliminar cuando la regla específica lo permita.

Actas administrativas:

- Fecha.
- Descripción.
- Archivo.
- Sin efecto automático adicional.

No se mantiene historial de versiones reemplazadas salvo cuando ya exista una obligación histórica explícita.

---

El Kiosco permanece habilitado para colaboradores a quienes aplica.

No aplica al Gerente Operativo de Servomotores.

Huella puede ser enrolada/reemplazada por Coordinación, CEO o Administrador, conservando autor/fecha.

La configuración de horarios tiene vigencia histórica; cambios posteriores no recalculan periodos anteriores.

Secuencia Kiosco:

- Entrada.
- Salida.

Se bloquean duplicados inválidos.

Entrada sin Salida queda `Salida faltante` sin producir automáticamente ausencia/descuento.

Retardo se determina por tolerancia. Ausencia por falta de Entrada en día laborable, excepto Vacaciones/Permisos.

Coordinación puede crear faltantes manuales por contingencia con motivo. CEO/Administrador puede corregir registros existentes con motivo e historial.

Vista administrativa Día/Semana/Mes con estados Normal, Retardo, Ausencia, Vacaciones, Permiso y Salida faltante.

---

---

### 9.2 Módulo Nómina

---

Nómina es módulo con ciclo propio.

Ruta general: periodo/empresa → preliminar → conceptos derivados → revisión → autorización CEO/Administrador → bloqueo/timbrado/documentos/pago.

Una Nómina autorizada no se reabre.

Horas extra, Bonos, Prima vacacional, Ajustes, Aguinaldo y otros conceptos alimentan el cálculo según sus reglas; no son módulos equivalentes a Nómina.

---


#### Recorrido de Nómina semanal

`Periodo/empresa → generar preliminar → integrar conceptos derivados → revisar faltantes → autorizar CEO/Administrador → bloquear periodo → timbrar/generar documentos → generar movimientos financieros → Pagada/Cerrada`.

##### Preliminar
Debe mostrar por Colaborador:
- salario base por componentes;
- incidencias/descuentos;
- Horas extra autorizadas pendientes de pago;
- Prima vacacional generada;
- Bonos aplicables;
- Ingreso/Descuento extraordinario;
- totales transferencia/efectivo.

Si falta un dato requerido para timbrar, identificar **qué Colaborador y qué dato** impide autorización.

##### Autorización
Solo CEO/Administrador. Una vez autorizada:
- no se reabre;
- los conceptos quedan congelados;
- las Horas extra incluidas pasan a `Pagada`;
- se generan documentos;
- se generan movimientos financieros.

Fallo de Facturapi deja el timbrado/documento fiscal recuperable sin reabrir el cálculo ni duplicar CFDI.

#### Recorrido de Horas extra

Personal ordinario:
`Empleado captura → Pendiente jefe → Jefe valida/rechaza → Pendiente CEO → CEO/Administrador autoriza/rechaza → Autorizada → próxima Nómina aplicable → Pagada`.

Ayudante General Servomotores:
`Gerente Operativo registra/solicita → Pendiente CEO → CEO/Administrador autoriza/rechaza → Nómina → Pagada`.

Al autorización final:
- se congela tarifa base;
- se calcula acumulación semanal lunes-domingo;
- horas 1-9 autorizadas = Doble;
- 10+ = Triple;
- una solicitud puede dividirse entre ambos tramos.

#### Bonos

Los bonos configurados se calculan para colaboradores elegibles y aparecen en el preliminar correspondiente. Incidencias justificadas no descalifican. CEO/Administrador puede ajustar antes del cierre según reglas vigentes.

#### Ajustes extraordinarios

En preliminar, Coordinación puede agregar `Ingreso extra`/`Descuento extra`. Después de agregarlos, solo CEO/Administrador puede modificarlos/eliminarlos antes de autorización. La Prima vacacional no entra por esta vía.

#### Aguinaldo

Es un proceso especial de Nómina para colaboradores elegibles. Usa salario diario total/proporcionalidad vigente, permite ajuste CEO/Administrador antes de autorizar y conserva documentos/movimientos como Nómina. Gerente Operativo Servomotores queda excluido.

#### Comisiones

Proceso **mensual separado de Nómina**:

`generar preliminar de comisión → cálculo desde fuentes vigentes → revisión/ajuste → validación CEO/Administrador → pago`.

Debe conservar:
- periodo;
- fuentes/facturación considerada;
- parámetros usados;
- cálculo original;
- ajuste;
- total final.

Cancelaciones posteriores a una comisión pagada no reescriben el corte; generan ajuste negativo futuro.

#### Reglas detalladas — Nómina y conceptos

---

Periodicidad semanal y separada por empresa.

Usuarios autorizados de Personal generan preliminar. Solo CEO/Administrador autoriza.

La autorización:

- Bloquea el periodo.
- Timbrará la parte fiscal aplicable mediante Facturapi.
- Genera documentos.
- Se considera pagada.
- Genera los movimientos financieros correspondientes en la misma empresa.

Una Nómina autorizada no se reabre; correcciones posteriores se manejan en periodos futuros mediante ajustes permitidos.

Si faltan datos necesarios para timbrar, debe identificarse colaborador/dato y bloquear autorización.

Ante fallo de Facturapi:

- Queda pendiente.
- Permite reintento.
- No duplica CFDI.

La fuente de pago puede ser banco/efectivo conforme a cada componente y conserva fotografía histórica.

Para el Gerente Operativo de Servomotores, la Nómina se limita al salario fijo y excluye los conceptos definidos en Personal.

---

Por empleado y periodo autorizado se conserva:

1. Documento interno consolidado de la empresa.
2. PDF/representación oficial del CFDI cuando aplique.
3. XML oficial del CFDI cuando aplique.

El consolidado identifica componentes relevantes, incluyendo:

- Salario timbrado.
- Salario en efectivo.
- Horas extra pagadas.
- Prima vacacional.
- Bonos.
- Ingresos extraordinarios.
- Descuentos.
- Total transferencia.
- Total efectivo.
- Total pagado.

La descarga masiva de un periodo genera un PDF único para impresión con orden estable. XML permanece descargable individualmente.

La reimpresión histórica reproduce el documento original.

---

Las reglas vigentes de Puntualidad y Productividad aplican a colaboradores ordinarios configurados.

Gerente Operativo de Servomotores está excluido de bonos por su regla laboral especial.

Puntualidad:

- Monto mensual por colaborador.
- Requiere no tener inasistencias ni retardos no justificados en el mes.

Productividad:

- Monto mensual por colaborador.
- Puede depender de la meta mensual de facturación de su empresa/esquema aplicable.

Las incidencias justificadas no descalifican.

CEO/Administrador puede ajustar antes del cierre conforme a reglas vigentes.

Los bonos conservan su tratamiento y trazabilidad en la Nómina correspondiente.

---

Cada colaborador elegible tiene tarifa base por hora extra configurable por CEO/Administrador.

Gerente Operativo de Servomotores no genera Horas extra.

##### Captura

Para personal ordinario, el empleado registra:

- Fecha.
- Hora exacta de inicio.
- Hora exacta de fin.
- Motivo.

El empleado no selecciona tipo Simple/Doble/Triple.

Para Ayudante General de Servomotores, el Gerente Operativo registra/solicita sus Horas extra en lugar del empleado.

##### Acumulación semanal

La semana de Horas extra es lunes-domingo y reinicia cada lunes.

Sobre las horas autorizadas acumuladas de la semana:

- Horas 1 a 9 -> Doble.
- Hora 10 en adelante -> Triple.

Una misma solicitud puede dividirse entre tramo Doble y Triple al cruzar el umbral.

Cálculo:

- Tarifa base x 2 para tramo Doble.
- Tarifa base x 3 para tramo Triple.

La tarifa vigente al momento de autorización final queda congelada.

##### Flujo

Personal ordinario:

- Pendiente jefe.
- Pendiente CEO.
- Autorizada.
- Rechazada.
- Pagada.

Jefe directo valida/rechaza.

CEO/Administrador realiza autorización final. Si CEO/Administrador es jefe directo, su acción resuelve el proceso.

Ayudante General:

- Gerente Operativo origina/registra la solicitud.
- CEO/Administrador realiza la autorización final.

##### Pago

Se paga en la Nómina aplicable posterior a la autorización conforme a la regla vigente; una Nómina cerrada no se reabre.

El importe se distribuye proporcionalmente entre componente timbrado y efectivo según la composición salarial del empleado.

Una solicitud pagada queda identificada para impedir duplicidad.

---

En preliminar, Coordinación puede agregar `Ingreso extra` o `Descuento extra` cuando corresponda.

Una vez agregado, solo CEO/Administrador puede editar/eliminar antes de autorización.

Después de autorización queda congelado.

La prima vacacional **no** se captura por este mecanismo; se genera automáticamente desde Vacaciones.

Gerente Operativo de Servomotores no recibe conceptos extraordinarios ordinarios por esta vía salvo una corrección estricta de su salario fijo autorizada expresamente. Distribuciones de utilidades se manejan fuera de Nómina.

---

Proceso especial de Nómina para colaboradores a quienes aplique.

Cálculo funcional usa salario diario total y proporcionalidad correspondiente, distribuyendo componentes según la composición salarial.

CEO/Administrador puede ajustar antes de autorizar.

Gerente Operativo de Servomotores está excluido de Aguinaldo por la regla laboral especial definida para su ficha.

---

Proceso mensual independiente de Nómina para esquemas elegibles.

Coordinación genera preliminar; CEO/Administrador puede ajustar y valida. La validación representa pago conforme a la regla financiera vigente.

El esquema actual de SYSTRON contempla:

- Vendedores.
- Gerente Operativo SYSTRON.
- Supervisor Técnico.

Vendedores mantienen intervalos de facturación con porcentajes para Servicios y Venta de equipo; el intervalo alcanzado aplica a toda la facturación correspondiente y no es progresivo.

Factura libre queda fuera.

Gerente Operativo SYSTRON puede tener mínimo mensual de facturación activa total y porcentaje.

Supervisor Técnico puede tener mínimo mensual de facturación activa de Servicios y porcentaje; Venta de equipo se excluye.

Se conserva cálculo original, parámetros, ajuste y total final.

Cancelaciones posteriores a una comisión pagada no reescriben el corte histórico; generan ajuste negativo futuro conforme a la regla vigente.

Gerente Operativo de Servomotores queda excluido de este proceso por su esquema especial de compensación.

---

---

## 10. Vistas de trabajo, seguimiento y análisis

---

### 10.1 Regla común de Paneles y bandejas

Los Paneles no duplican entidades.

Cada pendiente mostrado debe enlazar mediante folio/nombre al detalle real.

Cuando una transición cambia al responsable del siguiente paso, el Discovery debe indicar:

- quién recibe el pendiente;
- dónde aparece;
- qué acción principal puede ejecutar.

Ejemplos:

- Diagnóstico terminado → Gerente Operativo → `Diagnósticos pendientes de validación`.
- Diagnóstico validado → CEO/Administrador → `Pendientes de cotizar`.
- O.C. solicitada → CEO → O.C. pendientes de autorización.
- O.C. autorizada → Coordinación → O.C. pendientes de procesar.
- Factura/Remisión solicitada → Coordinación → bandeja correspondiente.

---


Además:

- cada bloque debe mostrar solo registros realmente accionables o consultables para el rol;
- el folio/nombre abre el detalle;
- la acción principal se ejecuta desde el detalle salvo que exista una acción rápida inequívoca y segura;
- cuando el estado cambia y deja de corresponder al bloque, desaparece automáticamente de esa bandeja;
- no existe un estado artificial `leído/resuelto` separado del estado real de la entidad.

### 10.2 Panel Técnico — Técnico

---

Una pantalla con bloques separados:

- Diagnósticos asignados.
- Reparaciones/OS asignadas.

Indicadores superiores:

- Diagnósticos pendientes.
- Reparaciones pendientes.
- Vencidos.
- En espera de refacciones.

Los indicadores funcionan como filtros.

Solo muestra activos.

Historial separado:

- Solo trabajos en los que el Técnico participó en algún momento.

Técnico no ve trabajos sin asignar.

---

---


Todo elemento muestra folio navegable. Al abrirlo, el Técnico debe ver la acción principal compatible con el estado: iniciar/continuar trabajo, agregar Bitácora, terminar o atender corrección, según corresponda.

`Vencidos` y `En espera de refacciones` son filtros/condiciones de trabajos reales, no entidades separadas.

### 10.3 Panel Técnico — Supervisor y Gerente Operativo

---

SYSTRON:

- Pestañas Activos/Historial.
- Pendientes de asignación.
- Diagnósticos activos.
- Reparaciones activas.
- Vencidos.
- En espera de refacciones.
- Trabajos en proveedor externo.
- Reasignación conforme a rol.

Gerente Operativo además tiene bloque:

`Diagnósticos pendientes de validación`

Cada elemento muestra al menos:

- Folio.
- Cliente.
- Equipo.
- Modalidad/tipo.
- Prioridad.
- Técnico que terminó.
- Fecha de término.
- Indicador de proveedor externo cuando aplique.

Desde el detalle puede validar o devolver a corrección.

Servomotores:

El Gerente Operativo utiliza un panel combinado para:

- Ingresos físicos pendientes.
- Diagnósticos/Reparaciones activas.
- Garantías.
- Pendientes de cotizar.
- Compras.
- Entregas/Egresos.
- Otros pendientes operativos de su empresa.

No se requiere replicar la organización interna de SYSTRON si no aporta valor.

---

---


Cada bloque abre la entidad real por folio.

En `Diagnósticos pendientes de validación`, la acción principal del detalle es `Validar` o `Devolver a corrección`.

En Servomotores, los bloques `Ingresos físicos pendientes`, `Pendientes de cotizar`, `Compras` y `Entregas/Egresos` deben enlazar a sus módulos correspondientes; el panel combinado no replica los datos como registros propios.

### 10.4 Panel de Ventas — SYSTRON

---

Pantalla orientada a acción.

Bloques:

- Cotizaciones por seguimiento.
- Entregas pendientes.
- Cobranza.
- Facturación pendiente.

El Vendedor también puede iniciar Cotizaciones. Mientras no tengan precio, aparecen como `Pendiente de cotizar` para CEO/Administrador y no están listas para envío.

Una vez fijado el precio, el Vendedor puede gestionar seguimiento, descuento permitido, destinatarios y decisión.

Entregas pendientes incluyen equipos listos y mercancía disponible.

Facturación pendiente incluye operaciones de clientes `Requiere factura = Sí` con importe pendiente; una Remisión no elimina esa obligación.

`Mi desempeño` conserva indicadores comerciales propios y nunca muestra costos internos, precio base Servomotores, utilidad global ni Nómina.

---

---


Además debe incluir:

- **Agenda / próximas actividades**: actividades del día/próximas del Vendedor y acceso a la Agenda Comercial completa.
- `Mi desempeño`: acceso a métricas/metas propias.

Navegación:
- Cotización → folio abre Cotización.
- Entrega → folio de Venta/EQUI/MOT/operación abre detalle correspondiente.
- Cobranza → Factura/CxC/Cliente abre entidad real.
- Facturación pendiente → operación origen abre detalle.
- Agenda → actividad permite abrir Cliente/Prospecto relacionado.

Resolver un pendiente mediante el flujo real debe retirarlo del bloque automáticamente.

### 10.5 Producción Técnica

---

Módulo analítico de monitoreo, separado del Panel Técnico.

Acceso:

- CEO.
- Administrador.
- Coordinación según empresa activa.

Indicadores pueden incluir Equipos atendidos, Diagnósticos, Reparaciones terminadas, Sin reparación, Valor producido, Ticket promedio, Garantías y Efectividad.

La atribución usa al usuario que dejó el resultado técnico final validado.

SYSTRON:

- Gerente Operativo no recibe producción técnica porque no ejecuta trabajo.
- Diagnóstico devuelto y posteriormente cerrado por otra persona se atribuye al cierre final que fue validado.

Servomotores:

- Gerente Operativo sí puede recibir atribución técnica porque ejecuta directamente el trabajo.

Trabajo 100% externo no genera producción económica individual. Trabajo mixto no asigna artificialmente el valor externo.

Garantía no aporta valor/ticket y la efectividad conserva la relación con la reparación original conforme a la fórmula vigente.

No existen metas formales de Producción Técnica en alcance actual.

---

---

### 10.6 Panel del CEO

---

El Panel siempre corresponde a **una sola empresa activa**.

No existe vista, suma, comparación ni resumen consolidado SYSTRON + Servomotores.

Orden funcional:

1. Decisiones pendientes.
2. Alertas actuales.
3. Resumen Comercial.
4. Resumen Producción Técnica.
5. Resumen Financiero.

Pendientes pueden incluir:

- `Pendientes de cotizar` de cualquier origen.
- O.C. pendientes de autorización.
- Garantías no procedentes que requieren decisión.
- Servicio Externo cuando corresponda.
- Nómina.
- Comisiones.
- Horas extra.
- Notas de crédito.
- Cancelaciones fiscales.
- Reembolsos/excepciones.

Las alertas derivan del estado real y desaparecen al resolver la condición; no requieren estados artificiales de leído/descartado.

Los resúmenes reutilizan las definiciones de los módulos de origen y navegan a ellos.

En SYSTRON, el CEO puede consultar costo/Cotización base de Servomotores para MOT, pero esa información no se expone al Vendedor.

---

---


Cada pendiente del CEO debe indicar la entidad y acción esperada. Como mínimo:
- `Pendientes de cotizar` → Cotización → asignar/ajustar precio.
- `O.C. pendientes de autorización` → O.C. → autorizar/rechazar.
- Garantía no procedente pendiente de decisión comercial → Garantía → cotizar/aceptar garantía.
- autorizaciones de Personal/Nómina → entidad correspondiente → decidir.

El folio abre detalle y la resolución cambia el estado real del registro.

### 10.7 Panel de Coordinación de Administración

---

Bandeja diaria por **empresa activa**. Nunca mezcla SYSTRON y Servomotores.

Bloques principales:

- Facturación.
- Remisiones.
- Pagos.
- Compras/O.C.
- CxP.
- Cobranza.
- Nómina.
- Pendientes de comprobación cuando existan.

Facturación:

- Solicitudes pendientes.
- Operaciones `Requiere factura = Sí` con importe pendiente.

Remisiones:

- Solicitudes pendientes de generación.

Compras/O.C.:

- Compras directas pendientes de validar/cuadrar.
- O.C. autorizadas pendientes de procesar.

Pagos:

- Pendientes de validación, más antiguos primero.

CxP/Cobranza:

- Vencidas y próximas a vencer conforme a las reglas vigentes.

Nómina:

- Estado semanal y faltantes que impiden timbrado.

En Servomotores muestra además pagos/egresos pendientes de comprobación o factura para regularización.

---

---


Cada bloque administrativo abre por folio/nombre la entidad real. Como mínimo:
- Compra directa pendiente → validar/cuadrar.
- O.C. autorizada → procesar a Egreso/CxP.
- Factura/Remisión solicitada → validar datos y emitir/generar.
- Pago pendiente → validar.
- pendientes de Nómina/Personal permitidos → operar conforme a rol.

No crear una segunda lista de “pendientes administrativos” desconectada del estado de las entidades.

### 10.8 Reportes

---

Módulo de consulta.

Los Reportes siempre se ejecutan sobre la **empresa activa**. No existe reporte consolidado de SYSTRON + Servomotores.

CEO/Administrador ven los reportes permitidos de la empresa activa. Otros roles solo información que ya pueden consultar.

Reportes iniciales:

1. Cotizaciones.
2. Conversión comercial.
3. CxC.
4. CxP.
5. Ingresos/Egresos.
6. Producción por ejecutor técnico.
7. Diagnósticos y SLA.
8. Reparaciones y resultados.
9. Inventario actual cuando la capacidad esté habilitada.
10. Nómina y Asistencia.

Filtros incluyen fechas/periodos, responsable, Cliente/Proveedor, estado, tipo y origen según aplique.

Exportación Excel y PDF cuando tenga sentido.

No existe constructor libre, diseñador personal de columnas, programación periódica ni envío automático.

---

---


Cuando un Reporte muestre entidades identificables mediante folio/nombre, ese identificador debe abrir su detalle si el rol tiene permiso. El Reporte no crea copias operables de los registros.

## 11. Administración del sistema

---

### 11.1 Módulo Configuración

---

Cada usuario ve solo secciones que puede administrar.

#### General por empresa

CEO/Administrador.

Cada empresa mantiene independientemente:

- Identidad.
- Datos fiscales.
- Domicilio.
- Contactos.
- Logotipo.
- Parámetros comerciales/operativos aplicables.
- Bancos/Efectivo.
- Catálogos financieros.
- Prioridades y SLA.

Cambios en SYSTRON no alteran Servomotores y viceversa.

#### Integraciones

Solo Administrador.

Debe permitir configuración protegida de:

- Facturapi por empresa.
- SendGrid.
- WhatsApp/Baileys cuando se habilite.
- Otras integraciones confirmadas.

Credenciales no vuelven a mostrarse completas.

Si falta configuración, se informa y se deshabilita/advierte la acción dependiente; nunca se simula éxito.

#### Diagnóstico y Reparación

CEO/Administrador mantienen catálogos independientes por empresa:

- Prioridades.
- Precio.
- Tiempo objetivo.
- SLA máximo.
- Incremento porcentual de Reparación cuando aplique.

Los cambios afectan nuevos casos; operaciones existentes conservan snapshot.

#### Comercial

Incluye tipos/categorías, metas, esquemas de comisión y parámetros autorizados.

El límite de descuento del Vendedor se configura en su ficha.

#### Compras

En la ficha del Gerente Operativo se configuran:

- Presupuesto mensual de compra directa.
- Máximo individual por compra directa.

Defaults iniciales:

- $5,000 MXN mensual.
- $2,000 MXN por compra.

#### Finanzas y Personal

Los catálogos/parametrización se administran por empresa conforme a permisos.

#### Usuarios

CEO y Administrador administran usuarios operativos; CEO no ve Administradores. Administrador sí.

#### Capacidades de empresa

Administrador puede habilitar el Inventario de Servomotores. Inicialmente queda deshabilitado.

---

---


Regla de efecto temporal de configuración: cuando una configuración ya fue congelada como fotografía histórica de una operación (por ejemplo prioridad/SLA/precio incremental, crédito u otra condición definida), cambiar el valor de Configuración afecta nuevos casos y no reescribe automáticamente los casos históricos ya congelados.

### 11.2 Integraciones

---

#### Facturapi

Configuración fiscal independiente por empresa.

Usos:

- Facturas.
- CFDI Nómina.
- Complementos/cancelaciones/refacturación aplicables.

Ante fallo:

- Se conserva la operación.
- Estado pendiente/error.
- Mensaje entendible.
- Reintento desde el mismo registro.
- Prevención de duplicado.

#### SendGrid

Default para correo cuando corresponda.

Si no está configurado, la acción dependiente se deshabilita o advierte.

Un fallo de correo no revierte una operación principal ya exitosa.

#### WhatsApp

Baileys por QR cuando se habilite. Administrador autorizado puede vincular, ver estado, reconectar y volver a vincular.

#### Producción

Producción nunca finge CFDI, correo, WhatsApp ni integración exitosa.

La simulación solo existe dentro de Modo de Pruebas y debe estar claramente marcada.

---

---

### 11.3 Modo de Pruebas

---

Solo Administrador puede configurarlo.

Cualquier Administrador puede finalizarlo.

#### Propósito

Permite probar procesos completos utilizando como punto de partida una fotografía del estado real sin afectar producción.

#### Activación

Administrador selecciona:

- Usuarios específicos.
- Roles completos.

Todos comparten un único contexto de prueba.

Solo puede existir una prueba activa a la vez.

La activación aplica inmediatamente a todas las sesiones activas de los usuarios seleccionados.

#### Punto de partida

Al activar:

- Se toma como referencia el estado real existente en ese momento.
- Los participantes ven los datos de las empresas a las que tienen acceso, respetando el contexto activo, incluidos Clientes, EQUI/MOT, OS, saldos, etc.
- Desde ese instante sus cambios son temporales y exclusivos de prueba.

#### Producción paralela

Usuarios no seleccionados:

- Siguen operando normalmente en producción.

Los cambios posteriores de producción:

- No modifican el escenario de prueba ya iniciado.

Cuando termina:

- Los participantes vuelven a la realidad actual de producción, incluyendo todo lo sucedido mientras probaban.

#### Persistencia durante la prueba

Mientras siga activa:

- Se puede cerrar sesión.
- Reingresar.
- Continuar donde se quedó el escenario.
- Probar flujos entre varios roles.

No se conservan escenarios anteriores después de finalizar.

#### Advertencia

Todas las pantallas de un participante muestran una advertencia persistente:

`MODO DE PRUEBAS — Los cambios realizados en este contexto serán descartados y no afectan la operación real.`

No puede ocultarse.

#### Efectos bloqueados

No se ejecutan efectos reales externos:

- Timbrado CFDI.
- Timbrado Nómina.
- Cancelaciones fiscales.
- Complementos reales.
- Correos reales.
- WhatsApp reales.
- Otras acciones externas con efectos reales.

Puede mostrarse una simulación funcional marcada:

`PRUEBA / SIN VALIDEZ`

#### No impacto en producción

No afecta:

- Folios reales, incluida la secuencia global MOT.
- Inventario real.
- Bancos/Efectivo.
- CxC.
- CxP.
- Movimientos financieros.
- Producción Técnica.
- Reportes reales.
- Nómina real.
- Historial real.

No existe promoción de datos de prueba a producción.

#### Finalización

Cualquier Administrador puede finalizar.

Se muestra advertencia explícita:

- Acción definitiva.
- Todos los cambios temporales se descartan.
- No podrán recuperarse ni transferirse.

Al confirmar:

- Se elimina el contexto temporal.
- Los usuarios vuelven inmediatamente a producción.

#### Límites

Para evitar sobreingeniería:

- Un solo escenario simultáneo.
- Sin escenarios históricos.
- Sin ramas.
- Sin restaurar pruebas previas.
- Sin fusionar prueba con producción.

El objetivo funcional es que el costo dependa principalmente de la actividad de prueba y no de mantener permanentemente una segunda operación completa.

---

---

---

## 12. Validación, construcción y cierre

---

### 12.1 Regla de completitud de módulo

Un módulo no se considera terminado por tener menú, listado o formulario.

Para cada entidad principal se debe comprobar:

1. rutas válidas de creación;
2. campos necesarios en cada momento;
3. listado, búsqueda y filtros;
4. navegación al detalle por folio/nombre;
5. acciones por estado/rol;
6. relaciones existentes navegables;
7. automatizaciones y transferencia de responsabilidad;
8. documentos;
9. errores y reintentos;
10. cierre e historia funcional.

---

### 12.2 Criterios de aceptación funcionales

---

#### Multiempresa

- SYSTRON y Servomotores no mezclan Clientes, Proveedores, Finanzas, Nómina ni Reportes.
- CEO, Coordinación y Administrador cambian de empresa explícitamente.
- No existe dashboard consolidado.
- Solo MOT usa secuencia global compartida.
- Búsqueda global respeta empresa activa y visibilidad.

#### EQUI/MOT y custodia

- EQUI mantiene identidad SYSTRON por etiqueta interna.
- MOT mantiene identidad global y trazabilidad entre empresas.
- MOT SYSTRON no pasa por Almacén SYSTRON.
- Ingreso Servomotores inicia SLA.
- Salida a prueba no cierra artificialmente el proceso.
- Egreso definitivo conserva destinatario físico sin convertirlo en Cliente.

#### Diagnóstico y Reparación

- Diagnóstico terminado SYSTRON requiere validación de Gerente Operativo antes de cotizar.
- Una devolución a corrección conserva motivo/historia.
- Reparación preautorizada puede avanzar técnicamente antes del precio.
- Prioridad de Reparación congela porcentaje/SLA.
- Refacciones incompletas fuerzan espera.
- Cierre técnico no equivale a cierre administrativo.

#### MOT intercompañía

- SYSTRON puede ver estado y Bitácora Técnica de Servomotores en solo lectura.
- Vendedor SYSTRON no ve Cotización base.
- Gerente Operativo Servomotores no ve precio final SYSTRON.
- Decisión final del cliente SYSTRON propaga Autorizada/No autorizada a la Cotización vinculada de Servomotores.
- Factura Servomotores genera CxC Servomotores y CxP SYSTRON sin duplicar dinero.
- Pago intercompañía es flujo real entre cuentas.

#### Garantía

- Reclamo inicia como Diagnóstico de Garantía.
- Gerente Operativo determina procedencia.
- CEO puede aceptar comercialmente una garantía no procedente antes de consecuencias incompatibles.
- Vigencia original es 6 meses y no se reinicia por una garantía.
- Nueva reparación pagada crea nuevo periodo.

#### Cotizaciones

- Vendedor puede crear/iniciar, pero no fijar precio.
- Todos los casos que requieren precio llegan a `Pendiente de cotizar`.
- CEO/Administrador determina precio.
- Vendedor aplica descuento solo dentro de su límite.
- Cotización sin equipo autorizada no crea OS hasta Ingreso físico.
- Revisiones no alteran silenciosamente CFDI/pagos existentes.

#### Compras/O.C.

- Compra directa solo es válida dentro de máximo individual y presupuesto mensual.
- Defaults: $2,000 por compra y $5,000 por mes, configurables.
- El presupuesto se reinicia por mes calendario y no acumula sobrantes.
- Compra pendiente consume presupuesto.
- Si una edición rebasa límites, pasa a O.C.
- Solo CEO autoriza O.C.
- O.C. autorizada no consume presupuesto de compra directa.
- O.C. no crea deuda/dinero por sí sola.
- Cada Compra/O.C. procesada termina exactamente en 1 Egreso o 1 CxP.
- Cambios materiales de O.C. autorizada requieren nueva autorización.
- CEO/Coordinación pueden cancelarla con motivo.

#### Inventario

- Inventarios de empresas nunca se comparten.
- SYSTRON usa mínimos/máximos informativos.
- Servomotores inicia con Inventario deshabilitado y Administrador puede habilitarlo.
- Habilitarlo no copia existencias de SYSTRON.

#### Facturación/Remisiones/Pagos

- Vendedor no genera Remisión; la solicita.
- Coordinación genera Factura/Remisión.
- Facturapi falla sin duplicar documentos.
- Pagos solo reducen saldos cuando están validados.
- Factura intercompañía puede emitirse independientemente del cierre técnico/facturación final.
- Pago anticipado pendiente de comprobación se regulariza sin duplicar salida.

#### Personal

- Vacaciones las solicita el jefe, no el empleado.
- Prima vacacional 25% se genera automáticamente y se reparte por semana/composición salarial.
- Horas extra usan acumulación semanal: 1-9 Doble, 10+ Triple.
- Empleado no elige tipo de hora extra.
- Ayudante General tiene Horas extra originadas por su Gerente Operativo y autorización final CEO/Administrador.
- Gerente Operativo Servomotores solo recibe salario fijo y está excluido de asistencia, Vacaciones, prima, horas extra, Aguinaldo y bonos.

#### Paneles/Reportes

- Paneles siempre corresponden a empresa activa.
- CEO ve `Pendientes de cotizar` unificados y O.C. por autorizar.
- Coordinación ve O.C. autorizadas pendientes de procesar y Compras directas pendientes de validar.
- Reportes no consolidan empresas.

#### Modo de Pruebas e Integraciones

- Usuarios seleccionados operan un contexto temporal sin afectar producción.
- Efectos externos reales quedan bloqueados.
- La prueba respeta el contexto multiempresa.
- Falta de configuración se muestra y no se simula éxito.
- Reintentos no duplican operaciones.

---

---


#### Rutas, navegación y handoffs

- `Crear Atención` no permite omitir Tipo de Atención ni prioridad cuando el tipo tiene prioridad definida.
- Crear Cotización sin equipo físico solicita identificación preliminar suficiente sin crear EQUI/MOT artificial.
- Toda entidad principal abre detalle desde folio/nombre en listados, Paneles y relaciones.
- No existen botones redundantes `Ver ficha` cuando el folio/nombre ya navega.
- Después de una acción exitosa el usuario permanece en el detalle.
- Cada transición que cambia responsable coloca el registro en la bandeja/panel del siguiente rol.
- Resolver el proceso retira el registro de la bandeja por su cambio de estado real.

#### Operación Técnica extremo a extremo

- Diagnóstico terminado aparece al Gerente Operativo para validación.
- Devuelto a corrección vuelve al ejecutor con motivo y exige nueva terminación.
- Diagnóstico validado que requiere precio aparece en `Pendientes de cotizar`.
- Diagnóstico externo conserva Proveedor, salida, retorno y obligación económica relacionada.
- Solicitud de Refacción incompleta mantiene OS en espera; surtido suficiente permite continuar.
- Reparación preautorizada no se bloquea esperando precio.
- Cierre técnico no oculta pendientes comerciales, fiscales o físicos.

#### MOT intercompañía extremo a extremo

- MOT SYSTRON aparece como Ingreso pendiente en Servomotores.
- Ingreso Servomotores inicia el SLA definido.
- SYSTRON consulta Bitácora/estado en solo lectura.
- Cotización base Servomotores genera el pendiente comercial SYSTRON correspondiente sin exponer el costo al Vendedor.
- Decisión final SYSTRON se propaga al registro Servomotores.
- Factura intercompañía crea CxC/CxP relacionadas al mismo MOT.
- Pago real liquida/aplica sin crear movimiento ficticio.

#### Personal y Nómina extremo a extremo

- Vacaciones solo pueden ser originadas por jefe/rol definido y autorizadas por CEO/Administrador.
- Vacación autorizada descuenta días hábiles aplicables, marca Asistencia y genera Prima vacacional automática.
- Prima se reparte correctamente si cruza semanas de Nómina.
- Horas extra recorren las aprobaciones definidas y una vez pagadas no vuelven a incluirse.
- Salida faltante no genera automáticamente Ausencia/descuento.
- Nómina autorizada no se reabre.
- Fallo fiscal permite reintento sin duplicar CFDI.
- Gerente Operativo Servomotores no recibe conceptos laborales excluidos.
- Comisiones permanecen como proceso mensual separado de Nómina y conservan cálculo histórico.

#### Agenda y Panel de Ventas

- Panel de Ventas muestra Agenda/próximas actividades y acceso a Día/Semana/Mes.
- Actividad relacionada permite abrir Cliente/Prospecto.
- Cliente/Prospecto permite consultar actividades relacionadas.
- Agenda no genera recordatorios automáticos no definidos.

### 12.3 Dependencias principales

---

- Todo registro transaccional pertenece a una empresa, salvo identidad MOT global.
- EQUI depende de Cliente SYSTRON.
- MOT directo depende de Cliente Servomotores; MOT originado SYSTRON enlaza Cliente final solo en SYSTRON y Cliente fijo `SYSTRON` en Servomotores.
- Atención técnica inicia SLA con Ingreso físico.
- Diagnóstico SYSTRON requiere validación de Gerente Operativo antes de cotizar.
- Reparación puede iniciar antes de precio por ser preautorizada.
- Cotización sin equipo autorizada espera Ingreso físico antes de OS.
- Facturación depende de identidad fiscal suficiente de la empresa/Cliente.
- Remisión la genera Coordinación a solicitud permitida.
- Compra directa depende de límites vigentes del Gerente.
- O.C. depende de autorización CEO antes de procesamiento.
- Compra/O.C. procesada termina en Egreso o CxP, nunca ambos.
- CxP intercompañía depende de Factura Servomotores relacionada.
- Pago intercompañía afecta cuentas reales de ambas empresas.
- Nómina depende de empresa, colaborador y reglas laborales aplicables.
- Paneles/Reportes dependen de datos de origen y empresa activa.
- Modo de Pruebas debe respetar todas las reglas anteriores sin afectar producción.

---

---

### 12.4 Plan de construcción y validación

---

Las mismas fases deben aparecer, con idéntico alcance y orden, en el archivo `SYGOS_3.0_PLAN_VALIDACION_FINAL.md`.

#### Fase 1 - Base multiempresa, usuarios, configuración y maestros

Incluye:

- Empresas y contexto activo.
- Usuarios/roles/permisos.
- Configuración base e integraciones configurables.
- Clientes/Contactos.
- Prospectos.
- Proveedores.
- Folios y reglas transversales.
- Búsqueda global restringida.

#### Fase 2 - EQUI, MOT, custodia física e Inventario

Incluye:

- EQUI.
- MOT y secuencia global.
- Almacén SYSTRON.
- Ingresos/Resguardo/Egresos Servomotores.
- Salida a prueba.
- Inventario SYSTRON.
- Inventario Servomotores deshabilitado/habilitable.
- Refacciones y movimientos físicos.

#### Fase 3 - Operación técnica, Garantías y relación Servomotores

Incluye:

- Diagnóstico.
- Validación Gerente Operativo.
- Bitácora Técnica.
- Reparación preautorizada.
- OS.
- SLA.
- Diagnóstico de Garantía.
- Servicio Externo/Maquila.
- Flujo MOT SYSTRON <-> Servomotores.
- Reflejo de estado/bitácora.

#### Fase 4 - Operación comercial

Incluye:

- `Pendientes de cotizar`.
- Cotizaciones iniciadas por Vendedor.
- Precios CEO/Administrador.
- Descuentos por límite.
- Cotización sin equipo físico.
- Cotización intercompañía.
- Venta de equipo.
- Servicio en campo.
- Panel Ventas.
- Agenda y metas comerciales.

#### Fase 5 - Facturación, Remisiones, Pagos, Cobranza e intercompañía fiscal

Incluye:

- Facturación por empresa.
- Factura libre.
- Remisiones solicitadas/generadas.
- Pagos.
- CxC/Cobranza.
- Facturación Servomotores -> SYSTRON.
- CxC/CxP espejo vinculada.
- Pago intercompañía.
- Fallos/reintentos fiscales.

#### Fase 6 - Compras, O.C., Finanzas y CxP

Incluye:

- Compras directas.
- Presupuesto mensual/límite individual.
- O.C. y autorización CEO.
- Procesamiento por Coordinación.
- Egreso/CxP 1:1.
- Bancos/Efectivo/Tarjetas.
- Ingresos/Egresos.
- CxP.
- Pendientes de comprobación.
- Dashboard financiero por empresa.

#### Fase 7 - Personal, Asistencia, Vacaciones, Nómina y Comisiones

Incluye:

- Colaboradores por empresa.
- Jefe directo.
- Kiosco.
- Vacaciones.
- Prima vacacional automática.
- Nómina.
- Horas extra Doble/Triple.
- Bonos.
- Aguinaldo.
- Comisiones.
- Reglas especiales Servomotores.

#### Fase 8 - Producción, paneles ejecutivos y Reportes

Incluye:

- Producción Técnica.
- Panel CEO por empresa.
- Panel Coordinación por empresa.
- Panel Gerente Operativo Servomotores.
- Reportes.
- Navegación analítica sin consolidación de empresas.

#### Fase 9 - Integraciones, Modo de Pruebas y cierre transversal

Incluye:

- Integraciones completas.
- Manejo de configuración faltante.
- Errores/reintentos.
- Modo de Pruebas.
- Concurrencia.
- Documentos/archivos.
- Responsive/PWA.
- Validación extremo a extremo de SYSTRON, Servomotores e intercompañía.

---

---

### 12.5 Pendiente de cierre operativo externo

---

El nombre formal del proyecto es:

`SYGOS 3.0`

La URL real del repositorio GitHub **todavía no está disponible** y no debe inventarse.

Por decisión actual:

- Los archivos finales se entregan para carga manual.
- Cuando exista el repositorio real, su URL podrá incorporarse a la metadata del proyecto.
- No se afirma que exista una conexión de escritura a GitHub.

---

---

### 12.6 Criterio final para Cursor

---

Este documento es la fuente de verdad funcional vigente de SYGOS 3.0.

Reglas sustituidas durante Discovery no deben implementarse por aparecer en versiones anteriores.

Cursor conserva libertad para decidir cómo implementar arquitectura, componentes, persistencia, frameworks, librerías, concurrencia, generación de documentos, PWA y demás decisiones técnicas internas.

El resultado debe respetar los comportamientos, permisos, trazabilidad, separaciones por empresa, estados, automatizaciones, excepciones, dependencias y criterios de aceptación aquí definidos.

---