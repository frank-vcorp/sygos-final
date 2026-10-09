# SYGOS 3.0 — Guía UX/UI y Patrones de Interacción

**Versión:** 1.0  
**Estado:** Complemento funcional de experiencia para construcción  
**Documento funcional de referencia:** `SYGOS_3.0_DISCOVERY_FUNCIONAL_VALIDADO.md`

> Esta guía no modifica reglas de negocio, permisos, estados, cálculos ni ciclos definidos en el Discovery. Define cómo presentar y operar esas capacidades para que SYGOS 3.0 se sienta intuitivo, moderno, consistente y rápido. Si existiera un conflicto funcional, prevalece el Discovery.

---

## 1. Objetivo de experiencia

SYGOS 3.0 debe sentirse como una aplicación SaaS moderna, no como un conjunto de formularios administrativos.

La experiencia debe reducir:
- clics innecesarios;
- navegación de ida y vuelta;
- formularios demasiado largos;
- información plana sin jerarquía;
- botones redundantes;
- búsquedas sin salida clara;
- dudas sobre qué elemento es interactivo;
- pantallas que obligan al usuario a recordar datos que el sistema ya conoce.

La interfaz debe ayudar al usuario a responder rápidamente:

1. ¿Dónde estoy?
2. ¿Qué registro estoy viendo?
3. ¿En qué estado está?
4. ¿Qué requiere mi atención?
5. ¿Qué puedo hacer ahora?
6. ¿Qué está relacionado con este registro?
7. ¿Cómo regreso al flujo sin perder lo que ya capturé?

### Principio rector

**El usuario no debe abandonar su tarea principal para buscar, crear, consultar o relacionar información auxiliar cuando el sistema pueda resolverlo de forma contextual.**

---

## 2. Lenguaje visual general

### 2.1 Personalidad

La interfaz debe ser:
- moderna;
- profesional;
- sobria;
- clara;
- rápida de leer;
- de tema claro;
- visualmente consistente;
- con suficiente aire entre bloques;
- con jerarquía evidente;
- sin decoración innecesaria.

### 2.2 Jerarquía visual

La interfaz debe diferenciar claramente:
- título de la vista;
- identidad principal del registro;
- estado;
- información crítica;
- acción principal;
- acciones secundarias;
- enlaces navegables;
- datos auxiliares;
- historial.

No usar el mismo peso visual para todo.

### 2.3 Superficies

Usar agrupaciones visuales para separar contextos, por ejemplo:
- cabecera de entidad;
- bloque principal;
- secciones operativas;
- tarjetas/resúmenes;
- tablas;
- paneles de relaciones.

No convertir cada dato en una tarjeta independiente. Las tarjetas deben agrupar información con una intención clara.

### 2.4 Color y estados

Usar una paleta sobria con:
- un color principal de interacción;
- neutrales para estructura;
- colores semánticos para estados y alertas.

Los colores no deben ser la única forma de entender un estado. Todo estado debe tener texto visible.

No fijar colores de marca arbitrarios si no existe una definición de marca aprobada. Sí exigir contraste suficiente y consistencia.

### 2.5 Densidad

Las vistas operativas pueden ser densas, pero nunca apretadas.

Priorizar:
- lectura rápida;
- alineación consistente;
- espacios predecibles;
- columnas solo cuando aporten valor;
- información secundaria visualmente subordinada.

---

## 3. Navegación global y affordance

### 3.1 Regla de navegación por identificador

En listados, paneles, relaciones y búsquedas:
- el **folio** es el enlace al detalle cuando existe;
- cuando no existe folio operativo, el **nombre principal** es el enlace;
- no usar botones redundantes como `Ver`, `Ver ficha` o `Abrir` si el folio/nombre ya cumple esa función.

### 3.2 Todo enlace debe parecer enlace

Un elemento navegable no puede verse igual que texto estático.

Debe tener un tratamiento visual consistente que permita reconocerlo antes de hacer clic, por ejemplo:
- color de interacción;
- subrayado o cambio visible al pasar el cursor;
- cursor/estado de foco claro;
- icono discreto de navegación cuando ayude;
- respuesta visual al tocarlo en móvil.

No esconder navegación importante en texto plano sin affordance.

### 3.3 Relaciones navegables

Si una relación existe y el usuario tiene permiso:
- debe mostrarse mediante folio/nombre;
- debe abrir su detalle;
- debe permitir regresar al contexto previo.

Ejemplos:
- `DIAG-00182` desde una OS;
- `COT-00452` desde un Diagnóstico;
- `OC-00047` desde una CxP;
- Cliente desde una Cotización;
- EQUI/MOT desde cualquier operación técnica;
- Factura desde Cobranza;
- Proveedor desde Compra/O.C.

### 3.4 Navegación de contexto

Cuando el usuario llega a una entidad desde otra, el sistema debe conservar una ruta comprensible de regreso.

No se debe obligar a reconstruir filtros o búsquedas por haber abierto un detalle relacionado.

---

## 4. Listados

### 4.1 Objetivo

El listado sirve para:
- encontrar;
- comparar;
- priorizar;
- abrir.

No sirve para mostrar todos los campos de una entidad.

### 4.2 Estructura recomendada

La cabecera de un listado debe contener:
- título;
- acción de creación cuando el rol pueda crear;
- búsqueda;
- filtros principales;
- filtros activos;
- conteo o contexto útil cuando aporte valor.

La tabla/lista debe priorizar:
- folio/nombre navegable;
- relación principal;
- estado;
- responsable;
- prioridad;
- fecha relevante;
- importe cuando aplique;
- información que ayude a decidir qué atender primero.

### 4.3 Filtros

Evitar llenar la cabecera con botones de filtro.

Patrón esperado:

`Buscar…   Estado ▾   Responsable ▾   Periodo ▾   Más filtros`

Cuando hay filtros activos, mostrarlos como criterios removibles:

`Estado: Pendiente ×` `Prioridad: Alta ×`

Los estados muy frecuentes pueden usar pestañas o chips si realmente ayudan a cambiar de contexto rápidamente, pero no convertir todo filtro posible en botón.

### 4.4 Orden

El orden inicial debe responder a la naturaleza del módulo:
- pendientes: urgencia/antigüedad/SLA;
- Cobranza: días vencidos;
- Técnico: prioridad + SLA;
- O.C.: antigüedad del pendiente;
- Pagos por validar: antigüedad;
- historial: fecha descendente cuando sea natural.

### 4.5 Acciones en listado

No saturar cada fila con botones.

Las acciones que cambian el proceso deben preferentemente realizarse desde el detalle. En listado puede haber acciones rápidas solo cuando sean inequívocas, frecuentes y seguras.

---

## 5. Vista de detalle

### 5.1 La vista de detalle es el centro operativo

Toda entidad principal debe tener un detalle canónico.

Después de crear, editar, autorizar, validar, rechazar, cancelar o cerrar, el usuario permanece en el detalle actualizado.

### 5.2 Cabecera compacta

La parte superior debe responder inmediatamente:

- ¿Qué es?
- ¿De quién es?
- ¿En qué estado está?
- ¿Quién es responsable?
- ¿Qué fecha/plazo importa?
- ¿Cuál es la acción principal?

Cuando corresponda mostrar:
- folio/nombre;
- estado;
- Cliente/Proveedor/Colaborador;
- responsable;
- prioridad;
- fecha relevante;
- SLA;
- importe;
- empresa activa.

### 5.3 Orden interno

Orden conceptual recomendado:

1. Cabecera.
2. Información operativa principal.
3. Contenido propio del proceso.
4. Relaciones existentes.
5. Documentos.
6. Historial relevante.

No forzar exactamente las mismas secciones en todos los módulos.

### 5.4 Acción principal

Cada estado debe destacar una acción principal cuando exista.

Ejemplos:
- Cotización pendiente de precio → `Asignar precio`.
- Diagnóstico en ejecución → `Terminar diagnóstico`.
- Diagnóstico pendiente GO → `Validar diagnóstico`.
- O.C. pendiente CEO → `Autorizar`.
- O.C. autorizada en Coordinación → `Procesar`.
- Pago pendiente → `Validar pago`.

Acciones secundarias con menor jerarquía:
- editar;
- descargar;
- enviar;
- agregar nota;
- abrir relación.

Acciones excepcionales:
- cancelar;
- rechazar;
- reabrir;
- eliminar cuando esté permitido.

No presentar todas con el mismo peso visual.

### 5.5 Relaciones inexistentes

No mostrar bloques vacíos como:
- `Factura: No existe`;
- `Pago: No existe`;
- `Remisión: No existe`;

salvo que la ausencia sea funcionalmente relevante.

Cuando corresponda crear la relación, mostrar la acción:
`Solicitar factura`, `Generar remisión`, etc.

---

## 6. Búsqueda contextual y selectores de entidades

### 6.1 No usar selects gigantes

Para Clientes, Equipos, Proveedores, Contactos y otras entidades con crecimiento, usar búsqueda contextual.

El usuario debe poder buscar por identificadores relevantes.

Ejemplos:
- Equipo: EQUI/MOT, serial, marca, modelo.
- Cliente: nombre, razón social, contacto.
- Proveedor: nombre/razón social.
- Cotización: folio, Cliente, equipo.
- Colaborador: nombre.

### 6.2 Resultado de búsqueda

Cada resultado debe mostrar suficiente contexto para distinguirlo.

Ejemplo Equipo:

**EQUI-0187**  
Siemens · 1FK7063  
Serial XJ39203 · ACME Industrial

No mostrar solo `EQUI-0187`.

### 6.3 Contexto primero

Si el flujo ya conoce una relación, la búsqueda debe restringirse o priorizarla.

Ejemplo:
- si ya se seleccionó Cliente `ACME Industrial`, al buscar Equipo se muestran primero/sólo sus equipos cuando la regla lo permita;
- si una O.C. nace desde una OS, el destino ya está conocido;
- si una Cotización nace de Diagnóstico, Cliente, Equipo y Diagnóstico no vuelven a preguntarse.

---

## 7. Alta rápida

### 7.1 Regla general

Cuando una entidad relacionada no existe y el usuario tiene permiso para crearla:

`Buscar → no encontrar → Crear nuevo → capturar mínimo → guardar → regresar → seleccionar automáticamente`.

El usuario no debe perder lo que ya había capturado en el proceso principal.

### 7.2 La acción debe ser evidente

No usar texto plano escondido.

Cuando no hay resultado útil, mostrar una acción visual clara:

**No encontramos un equipo con esos datos.**  
`+ Crear equipo nuevo`

Si existe contexto:

`+ Crear equipo nuevo para ACME Industrial`

### 7.3 Herencia contextual

La creación rápida debe heredar lo que ya se conoce.

Ejemplo: alta rápida de Equipo desde Cotización después de seleccionar Cliente:
- Cliente: heredado, no volver a preguntar;
- Empresa: automática;
- pedir Tipo;
- Marca;
- Modelo;
- Descripción opcional;
- Serial opcional.

Al guardar:
- cerrar la creación rápida;
- regresar a Cotización;
- Equipo queda seleccionado.

### 7.4 Alcance de la creación rápida

Debe ser breve y suficiente para continuar.

No convertirla en el formulario completo de mantenimiento de la entidad.

Ejemplos adecuados:
- Cliente;
- Contacto;
- EQUI/MOT cuando el flujo lo permita;
- Tipo;
- Marca;
- Proveedor;
- Courier;
- otros catálogos simples autorizados.

No usar alta rápida para:
- Usuario;
- Colaborador;
- Rol;
- Cuenta financiera;
- Factura;
- Pago;
- Nómina;
- documentos sujetos a autorización formal.

### 7.5 Presentación

La implementación visual puede resolverse con panel contextual, diálogo, sección expandida u otro patrón moderno, siempre que:
- no pierda el contexto;
- no navegue innecesariamente fuera;
- sea evidente cómo cancelar;
- al guardar regrese al punto exacto.

---

## 8. Formularios

### 8.1 Formularios guiados, no paredes de campos

Agrupar por intención, no por modelo de datos.

Ejemplo `Nueva Atención`:

**Cliente y equipo**
- Cliente
- Equipo

**Servicio**
- Tipo de Atención
- Prioridad
- Falla reportada

**Información adicional**
- únicamente campos aplicables

### 8.2 Revelado progresivo

Mostrar campos cuando son aplicables.

Ejemplo:
- si Tipo = `Diagnóstico de Garantía`, mostrar antecedente de reparación;
- si Tipo = `Diagnóstico`, no mostrar campos de Garantía;
- si Factura = PPD, mostrar campos correspondientes cuando aplique;
- si compra = crédito, mostrar condiciones relacionadas;
- si entrega = courier, mostrar información de courier/tracking.

### 8.3 No volver a preguntar lo conocido

Si un dato puede heredarse, referenciarse o calcularse:
- prellenarlo;
- mostrarlo como contexto;
- no obligar al usuario a capturarlo nuevamente.

### 8.4 Obligatorio ahora vs obligatorio después

No bloquear el alta por información que solo es necesaria en un estado posterior.

Ejemplos:
- Cotización puede nacer sin precio;
- Cliente puede nacer antes de completar datos fiscales si aún no se factura;
- Cotización preliminar puede nacer sin EQUI físico.

### 8.5 Validación

Mostrar errores cerca del campo correspondiente y explicar qué falta.

No esperar hasta guardar para revelar una lista extensa de errores si pueden detectarse durante la captura.

### 8.6 Guardado

La acción principal debe indicar claramente el resultado:
- `Crear cotización`;
- `Guardar cliente`;
- `Registrar pago`;
- `Crear atención`.

Evitar botones ambiguos como `Aceptar`.

---

## 9. Patrones específicos de SYGOS

### 9.1 Crear Atención

Recorrido visual esperado:

`Cliente → Equipo → Tipo de Atención → Prioridad → Falla/contexto → Crear`

El selector de Tipo de Atención debe hacer visibles las opciones vigentes:
- Diagnóstico;
- Reparación;
- Diagnóstico de Garantía.

La prioridad debe mostrar contexto útil como SLA cuando corresponda.

### 9.2 Crear Cotización

Recorrido visual esperado:

`Cliente → Tipo → Equipo existente o datos preliminares → Contacto(s) → Conceptos/contexto → Guardar`

Si el equipo no existe:
- ofrecer alta rápida cuando corresponda;
- o permitir datos preliminares cuando el flujo permite Cotización sin equipo físico.

No pedir precio al Vendedor.

### 9.3 Crear Compra/O.C.

`Proveedor → concepto → destino → importe → condición → guardar/enviar`

Si no existe Proveedor:
`+ Crear proveedor`

Si nace desde OS/MOT/Inventario, heredar el destino.

### 9.4 Registrar Pago

La captura debe guiar:
`Cliente/origen → comprobante → importe → destino → distribución → registrar`

La suma distribuida debe mostrarse de forma comprensible:
- Total;
- Aplicado;
- Disponible/sin aplicar.

### 9.5 Personal/Nómina

Los detalles de Colaborador y Nómina deben evitar tablas planas gigantes.

Separar:
- relación laboral;
- asistencia;
- vacaciones;
- horas extra;
- documentos;
- Nómina;
- historial salarial restringido.

---

## 10. Vistas rápidas y contexto

### 10.1 Consulta sin perder la tarea

Cuando ayude a tomar una decisión, permitir consultar contexto resumido de una entidad relacionada sin abandonar el flujo principal.

Ejemplo Cliente:
- crédito;
- contacto principal;
- saldo vencido si el rol puede verlo;
- equipos;
- operaciones abiertas.

Ejemplo Equipo:
- marca/modelo;
- serial;
- último servicio;
- custodia actual;
- Atención activa.

### 10.2 La vista rápida no sustituye el detalle

Debe existir acceso claro al detalle completo.

No duplicar edición compleja dentro de una vista rápida.

---

## 11. Paneles y dashboards

### 11.1 Deben conducir a trabajo real

Un panel no es un conjunto de estadísticas decorativas.

Cada pendiente debe:
- representar una entidad real;
- mostrar folio/nombre navegable;
- indicar estado/responsable;
- permitir identificar la siguiente acción;
- desaparecer cuando la condición real se resuelve.

### 11.2 Indicadores

Los KPI deben ser accionables cuando tenga sentido.

Ejemplo:
`Pagos por validar: 6` → abre la lista filtrada de Pagos pendientes.

### 11.3 Rol y contexto

El panel debe mostrar claramente:
- usuario/rol;
- empresa activa;
- pendientes propios o globales según permiso.

No mezclar SYSTRON y Servomotores.

---

## 12. Estados de interfaz

Cada vista relevante debe contemplar:

### Vacío
Explicar qué significa y qué puede hacer el usuario.

Ejemplo:
**No hay equipos registrados para este Cliente.**  
`+ Crear equipo`

### Cargando
Mostrar que la operación está en proceso sin congelar la interfaz innecesariamente.

### Éxito
Confirmación breve, contextual y no invasiva.

Después de una acción exitosa, permanecer en el detalle actualizado.

### Error recuperable
Explicar:
- qué falló;
- qué información se conservó;
- qué puede reintentarse.

### Integración desconectada
Mostrar claramente que la acción depende de configuración faltante.

No simular éxito.

### Procesamiento externo
Evitar duplicar acciones mientras existe una operación externa en proceso.

---

## 13. Responsive

### Escritorio
Aprovechar espacio para:
- tablas;
- detalle con secciones;
- navegación contextual;
- paneles de información secundaria.

### Tablet
Mantener toda función crítica con menos columnas y agrupaciones adaptadas.

### Móvil
Priorizar:
- búsqueda;
- consulta de detalle;
- acciones principales;
- Agenda;
- captura rápida;
- evidencia;
- operación técnica necesaria.

No esconder acciones críticas por falta de espacio. Reorganizar, no eliminar.

---

## 14. Microinteracciones y feedback

Usar feedback discreto para:
- hover/foco en elementos navegables;
- selección;
- guardado;
- carga;
- errores;
- cambio de estado.

Evitar animaciones decorativas.

Una acción que cambia de estado debe reflejar inmediatamente:
- nuevo estado;
- nueva acción principal;
- nuevas relaciones si se generaron;
- desaparición del pendiente anterior.

---

## 15. Consistencia de textos

Usar verbos específicos:
- Crear;
- Guardar;
- Autorizar;
- Validar;
- Procesar;
- Enviar;
- Generar remisión;
- Solicitar factura;
- Registrar pago;
- Terminar diagnóstico.

Evitar:
- Aceptar;
- Continuar, cuando no queda claro qué ocurrirá;
- Procesar, si el proceso específico tiene un nombre más claro.

Los mensajes deben explicar la consecuencia.

Ejemplo:
`Autorizar O.C.`  
No: `Confirmar`.

---

## 16. Accesibilidad y usabilidad mínima

La construcción debe asegurar:
- contraste legible;
- foco visible;
- navegación razonable por teclado en formularios;
- áreas táctiles suficientes en móvil;
- estados no dependientes únicamente de color;
- etiquetas persistentes en campos importantes;
- mensajes de error asociados al dato que requiere corrección.

---

## 17. Patrones a evitar

No construir:
- páginas con información totalmente plana;
- listas con un botón `Ver ficha` por fila;
- filtros principales convertidos todos en botones;
- formularios que muestran todos los campos desde el inicio;
- selects enormes para entidades;
- altas rápidas ocultas como texto plano;
- relaciones sin apariencia de enlace;
- acciones críticas mezcladas con acciones administrativas;
- detalles que obligan a volver al listado para continuar;
- paneles decorativos sin acceso a la entidad real;
- modales anidados en exceso;
- duplicación de información que el sistema ya conoce;
- distintos patrones visuales para la misma acción en módulos diferentes.

---

## 18. Ejemplo de detalle operativo — OS

### Cabecera

**OS-00291** · `En reparación`  
**ACME Industrial** · **EQUI-0187** · Siemens 1FK7063  
Responsable: Carlos Méndez · Prioridad: Alta · SLA: 13 oct

**Acción principal:** `Terminar reparación`

Acciones secundarias:
`Solicitar refacción` · `Agregar bitácora` · `Más acciones`

### Trabajo técnico

Diagnóstico origen: **DIAG-00182**  
Última actividad: Hoy 10:42  
Bitácora: 7 registros

### Refacciones

2 solicitadas · 1 surtida · 1 pendiente

### Administración

Cotización: **COT-00452**  
Factura: todavía no existe  
Acción disponible: `Solicitar factura` cuando corresponda

### Custodia

En resguardo desde 8 oct.

Los folios y nombres en negritas representan relaciones navegables; visualmente deben distinguirse como interacción.

---

## 19. Ejemplo de alta rápida — Equipo desde Cotización

Contexto actual:
- Empresa: SYSTRON
- Cliente: ACME Industrial

Campo Equipo:

`Buscar por EQUI, serial, marca o modelo…`

Si no hay resultado:

**No encontramos un equipo para ACME Industrial con esos datos.**  
`+ Crear equipo nuevo`

Alta rápida:
- Cliente: ACME Industrial — heredado
- Tipo: obligatorio
- Marca: obligatoria
- Modelo: obligatorio
- Descripción: opcional
- Serial: opcional

Al guardar:
1. se crea el EQUI;
2. se cierra la alta rápida;
3. el usuario regresa exactamente a la Cotización;
4. el nuevo EQUI queda seleccionado;
5. los demás datos capturados en la Cotización permanecen intactos.

---

## 20. Checklist UX/UI obligatorio por pantalla

Antes de dar una pantalla por terminada, comprobar:

- [ ] ¿Se entiende dónde está el usuario?
- [ ] ¿La empresa activa está clara cuando aplica?
- [ ] ¿El folio/nombre navegable parece interactivo?
- [ ] ¿La acción principal está visualmente clara?
- [ ] ¿Las acciones no disponibles están ocultas o explicadas correctamente?
- [ ] ¿El listado muestra solo lo necesario?
- [ ] ¿Los filtros son comprensibles y no una pared de botones?
- [ ] ¿Los campos se agrupan por intención?
- [ ] ¿Se ocultan campos que todavía no aplican?
- [ ] ¿El sistema evita volver a pedir datos que ya conoce?
- [ ] ¿La búsqueda de entidades muestra suficiente contexto?
- [ ] ¿Existe alta rápida cuando está funcionalmente permitida?
- [ ] ¿La alta rápida conserva el contexto y selecciona el nuevo registro?
- [ ] ¿Las relaciones existentes son navegables?
- [ ] ¿El detalle evita información plana?
- [ ] ¿Vacío, carga, éxito y error están contemplados?
- [ ] ¿La pantalla funciona en escritorio, tablet y móvil?
- [ ] ¿Después de una acción exitosa se permanece en el detalle?
- [ ] ¿La pantalla respeta exactamente permisos, estados y reglas del Discovery?

---

## 21. Criterio para Cursor

Al construir o refinar SYGOS 3.0:

1. **No inventar nuevas reglas de negocio.**
2. Usar el Discovery como fuente de verdad funcional.
3. Usar esta guía como fuente de verdad de experiencia e interacción.
4. No considerar una pantalla terminada solo porque sea funcional.
5. Aplicar los patrones de esta guía de forma consistente en todos los módulos.
6. Inferir mejoras de presentación que reduzcan fricción siempre que no cambien el negocio.
7. Si existe una relación funcional, hacerla navegable de forma evidente.
8. Si una entidad relacionada puede crearse en contexto, usar alta rápida.
9. Si un dato ya se conoce, heredarlo/prellenarlo en lugar de pedirlo otra vez.
10. Si un campo solo aplica después de una decisión, revelarlo en ese momento.
11. Mantener estética y comportamiento coherentes entre módulos y roles.
12. Validar cada pantalla con el checklist anterior antes de darla por terminada.

---

## 22. Alcance de esta guía

### Incluye
- experiencia visual;
- navegación;
- interacción;
- búsqueda;
- altas rápidas;
- formularios;
- listados;
- detalle;
- paneles;
- estados de interfaz;
- responsive;
- consistencia.

### No modifica
- permisos;
- roles;
- estados de negocio;
- cálculos;
- procesos;
- entidades;
- documentos obligatorios;
- integraciones;
- reglas fiscales;
- reglas laborales;
- reglas técnicas.

Esos elementos continúan definidos por `SYGOS_3.0_DISCOVERY_FUNCIONAL_VALIDADO.md`.
