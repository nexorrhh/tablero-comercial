> **Nota:** esta es la versión pública de este documento, para el repositorio abierto en GitHub. Se sacaron el subdominio real de la cuenta de noCRM y los nombres reales de clientes/prospectos observados en la cuenta real de CIMOMET, reemplazados por los mismos nombres ficticios que usa la semilla de datos de ejemplo (`js/seed/seed-data.js`). El resto del contenido es idéntico al documento de trabajo interno.

# CIMOMET — Sistema de Gestión Comercial

Documento de contexto del proyecto. Fase 1: réplica funcional de noCRM.io, sin persistencia externa.

---

## 1. Contexto y objetivo

CIMOMET S.A. (metalmecánica, Rosario) usa hoy **noCRM.io** (cuenta `<tu-cuenta>.nocrm.io`) para la gestión comercial. El objetivo es construir un sistema propio que reemplace ese SaaS y que a futuro se integre con los demás sistemas internos de la empresa.

**Estrategia de tres etapas:**

1. **Fase 1 (este documento)** — Replicar la funcionalidad actual de noCRM, tal cual, sin conectar ninguna base de datos. El resultado es una réplica funcional completa que corre en el navegador y sirve para evaluar el sistema con las manos, no en abstracto.
2. **Fase 2** — Podar. Con la réplica andando, retirar lo que no aporta al modo de trabajo real de CIMOMET y revisar las lógicas que conviene cambiar. Recién con el alcance definido se elige y se conecta la persistencia.
3. **Fase 3** — Conectar. Integrar con presupuesto/cotizaciones, y desde ahí con producción (CIMOMET v3), cerrando el circuito Comercial → OT → Producción → Encuesta → Comercial.

**Regla rectora de la Fase 1: no innovar.** noCRM es un producto enlatado y hay que replicarlo como está, aunque algo parezca mejorable o directamente raro. El criterio es simple: no se puede decidir qué sacar hasta tener con qué comparar. Toda observación sobre qué convendría cambiar se anota, no se implementa.

**Corolario:** no se agregan entidades, campos ni tablas "para el futuro". El modelo de Fase 1 es el modelo de noCRM y nada más. Los puntos de anclaje para Fase 3 están en §10 como notas, no como código.

---

## 2. Alcance de la Fase 1

### Incluido

- Gestión de prospectos y listados de prospección
- Gestión de leads con pipeline de etapas
- Carpetas de clientes
- Campos configurables
- Etiquetas por categoría
- Actividades y recordatorios
- Comentarios y adjuntos por lead
- Usuarios, equipos y permisos
- Listados con filtros, ordenamiento y las tres vistas (tabla / lista / kanban)
- Exportación a CSV

### Explícitamente fuera de alcance

- **Cualquier base de datos o backend.** Ver §7.
- Cotizaciones y presupuestos (Fase 3)
- Órdenes de trabajo (Fase 3, vía CIMOMET v3)
- Encuesta de satisfacción (Fase 3)
- Integración con correo entrante/saliente — ver §12, decisión abierta
- Post-sales tasks de noCRM — no consta que CIMOMET las use
- Integración con telefonía / VoIP

---

## 3. Modelo de dominio

Origen del modelo: documentación pública de la API v2 de noCRM más observación de la aplicación en uso. La configuración específica de la cuenta de CIMOMET (etapas exactas, campos personalizados, categorías de etiquetas) **todavía no está relevada** — ver §12.

### Distinción central: Prospect vs Lead

noCRM separa deliberadamente **prospección** de **venta**:

- Un **prospect** es un contacto sin calificar, que vive dentro de un *listado de prospección*. Es una fila de una lista de llamadas.
- Un **lead** es una oportunidad de venta concreta, con monto, etapa y responsable.
- Un prospect se **convierte** en lead cuando califica. La conversión es un evento del sistema.

Esta separación se replica tal cual.

### Segunda distinción: Etapa vs Estado

Son **dos ejes independientes**, y esto es contraintuitivo pero deliberado:

- **Etapa (step)** — dónde está en el pipeline. Ordenada por posición. Ej: Por contactar → Contactado → Propuesta enviada → Negociación.
- **Estado (status)** — situación operativa del lead. Valores fijos: `todo`, `standby`, `won`, `lost`, `cancelled`.

Un lead puede estar en etapa "Por contactar" y tener estado `won`. En la aplicación real de CIMOMET esto se observa efectivamente (leads con trofeo de ganado en la primera etapa del pipeline). **Replicar los dos ejes por separado.** No colapsarlos en un solo campo de estado.

Semántica de los estados:

| Estado | Significado | Regla |
|---|---|---|
| `todo` | Requiere acción ahora | Estado por defecto al crear |
| `standby` | En espera hasta una fecha | Exige fecha de recordatorio obligatoria |
| `won` | Ganado | Cierra el lead, sella fecha de cierre |
| `lost` | Perdido | Cierra el lead |
| `cancelled` | Anulado | Cierra el lead |

### Tercera particularidad: el contacto vive dentro de la descripción

**noCRM no tiene entidad contacto.** Los datos de la persona se guardan como texto plano dentro de `lead.description`, con formato `Campo: valor`, una por línea, y un separador que marca dónde empieza la descripción libre:

```
Firstname: Natalia
Lastname: Bawer
Email: natalia.bawer@ejemplo.com
Phone: 801 274 6798
Address: 1234 N 7864 W - Salt Lake City, UT
---
Conocí a Natalia en un seminario. Podría estar interesada.
```

La aplicación parsea ese bloque al vuelo y expone los valores en dos formas: por tipo de campo (`email`, `phone`, `first_name`...) y por nombre visible (`"Email"`, `"Teléfono"`...).

**Esto se replica tal cual.** Es una de las decisiones más raras del producto y también una de las más características — es lo que les permite dar de alta un lead pegando el pie de firma de un mail. Hay que verla funcionando antes de decidir si se conserva.

Implica construir un **parser bidireccional**: texto → campos estructurados para mostrar y filtrar, y campos → texto al editar. Es el componente más delicado de la Fase 1. Los campos configurables de §4 son los que definen qué etiquetas reconoce el parser.

### Convención de nomenclatura de leads

En la operación real de CIMOMET el título del lead sigue el patrón:

```
CLIENTE - Contacto - Proyecto
```

Ejemplos observados (nombres de cliente anonimizados): `Acerplata - Balduzzi - Tanque de aceite`, `Norsider - Pizzano, Fernando - Torres de...`, `Paraná Construcciones - Pablo Rascon (Pórticos y M...)`.

Es una convención informal de los usuarios, no una regla del sistema. Se replica como está: título libre.

---

## 4. Modelo de datos

Sin base de datos, cada entidad es una colección en memoria. Aun así se define con forma de tabla —claves, tipos, relaciones por id— para que la migración posterior sea mecánica y no un rediseño.

Nombres en inglés, `snake_case`, plural. Toda entidad lleva `id`, `created_at`, `updated_at`.

### Núcleo comercial

**`pipelines`**
`name`, `is_default`, `position`

**`steps`** — etapas dentro de un pipeline
`pipeline_id` → pipelines, `name`, `position`

**`leads`**
`title`, `step_id` → steps, `status` (enum), `amount` (decimal), `currency`, `probability` (int 0-100), `starred` (bool), `next_action_at`, `remind_date`, `remind_time`, `reminder_duration` (int, minutos), `reminder_note`, `reminder_activity_id` → activities, `estimated_closing_date`, `closed_at`, `description` (text, incluye el bloque de campos), `owner_id` → users, `created_by_id` → users, `team_id` → teams, `client_folder_id` → client_folders

**`client_folders`** — "Carpetas de Clientes"
`name`, `description` (text, mismo formato de bloque de campos), `is_active` (bool), `owner_id` → users

### Prospección

**`prospecting_lists`**
`title`, `owner_id` → users, `is_archived` (bool)

**`prospects`**
`prospecting_list_id` → prospecting_lists, `company_name`, `contact_name`, `email`, `phone`, `custom_values` (mapa clave-valor), `status` (`pending` / `qualified` / `discarded`), `converted_lead_id` → leads

### Configuración

**`custom_fields`** — definen qué etiquetas reconoce el parser
`name`, `parent_type` (`lead` / `client`), `field_type`, `position`, `is_key` (bool, usado para detección de duplicados)

Tipos de campo de noCRM: `unset`, `email`, `phone`, `mobile`, `address`, `web`, `first_name`, `last_name`, `full_name`, `job`, `fax`, `vat`, `city`, `zipcode`, `state`, `country`, `company_id`, más hasta cinco personalizados.

**`tag_categories`**
`name`, `is_required` (bool)

**`tags`**
`tag_category_id` → tag_categories, `name`, `position`

**`lead_tags`** — relación
`lead_id`, `tag_id`

**`activities`** — tipos de actividad configurables, con jerarquía padre/hijo
`name`, `kind` (`call` / `email` / `meeting`), `icon`, `color`, `parent_id` → activities, `is_disabled` (bool), `position`

Ejemplo de jerarquía: "Llamada" como padre, con "Atendida" (verde) y "No atendida" (rojo) como hijos.

### Registro y trazabilidad

**`activity_logs`** — actividades efectivamente registradas sobre un lead
`lead_id` → leads, `activity_id` → activities, `user_id` → users, `logged_at`, `note`

**`comments`**
`parent_type` (`lead` / `prospect` / `prospecting_list`), `parent_id`, `user_id` → users, `body` (text)

**`attachments`**
`lead_id` → leads, `file_name`, `file_size`, `mime_type`, `uploaded_by_id` → users, `content` (ver §7, limitación de tamaño)

**`lead_history`** — auditoría de cambios
`lead_id`, `user_id`, `field_changed`, `old_value`, `new_value`, `changed_at`

### Usuarios y equipos

**`users`**
`first_name`, `last_name`, `email`, `phone`, `mobile_phone`, `role`, `is_active` (bool), `default_reminder_duration` (int)

**`teams`**
`name`

**`team_members`**
`team_id`, `user_id`, `is_manager` (bool)

---

## 5. Módulos

Cada módulo es autocontenido y se comunica con los datos únicamente a través del gateway (§7). Es lo que hace posible la poda de Fase 2 sin romper nada.

| Módulo | Responsabilidad |
|---|---|
| `auth` | Login local, sesión, resolución de rol |
| `leads` | CRUD de leads, cambio de etapa y estado, recordatorios |
| `pipeline` | Vista kanban, arrastrar entre etapas, totales por columna |
| `prospects` | Listados de prospección, alta masiva, conversión a lead |
| `clients` | Carpetas de clientes |
| `activities` | Registro de actividades, historial por lead |
| `parser` | Conversión bidireccional entre el bloque `Campo: valor` y campos estructurados |
| `config` | Etapas, pipelines, campos, categorías, etiquetas, tipos de actividad |
| `users` | Usuarios, equipos, permisos |
| `reports` | Totales por etapa, por vendedor, por período. Exportación CSV |

---

## 6. Flujos principales

### 6.1 Prospección → Lead

1. Se crea un listado de prospección (ej: "Prospect Objetivos de Oil & Gas") con una etiqueta asociada.
2. Se cargan prospects, manualmente o por importación CSV.
3. El vendedor recorre la lista y registra el resultado de cada contacto.
4. Un prospect que califica se **convierte en lead**: se crea el lead, se vuelcan los datos al bloque de campos de la descripción, y el prospect queda marcado con `converted_lead_id`.
5. El listado muestra el porcentaje completado.

### 6.2 Ciclo de vida del lead

1. Alta del lead (desde prospect, manual, o importación). Estado inicial `todo`, primera etapa del pipeline.
2. Asignación a un vendedor.
3. Registro de actividades sobre el lead. Cada una queda en `activity_logs`.
4. Avance por las etapas del pipeline.
5. Carga de monto y probabilidad cuando se conocen.
6. Puesta en `standby` con fecha de recordatorio si queda en espera.
7. Cierre: `won`, `lost` o `cancelled`. Se sella `closed_at`.

### 6.3 Recordatorios

- Un lead en `todo` con `next_action_at` vencida aparece destacado como pendiente del día.
- Un lead en `standby` muestra los días restantes hasta el recordatorio (observado en la app como badge "13d").
- Al vencer el recordatorio, el lead vuelve automáticamente a `todo`.
- Un lead sin próxima acción definida es una anomalía y debe ser visible como tal — es el corazón de la metodología de noCRM y hay que replicarlo.

---

## 7. Arquitectura y stack

- **Frontend:** HTML/JS vanilla, multi-archivo, modular. Sin framework.
- **Backend:** ninguno en Fase 1.
- **Persistencia:** `localStorage`, detrás del gateway.
- **Módulos enchufables:** cada módulo se registra y puede activarse o desactivarse.
- **Autenticación local por roles**, contra la colección `users` en memoria. No es seguridad real, es para poder probar los permisos.

### Gateway de datos único

**Regla dura: ningún módulo accede a `localStorage` ni a ningún almacenamiento directamente.** Todo pasa por una capa única con una interfaz del tipo `get`, `list`, `create`, `update`, `delete` por colección.

Esta es la decisión de arquitectura que sostiene todo lo demás. Cuando en Fase 2 se elija la persistencia definitiva, se escribe un adaptador nuevo detrás de la misma interfaz y **no se toca ni un módulo**. Si esta regla se rompe en algún lado, la migración deja de ser un cambio de adaptador y pasa a ser una reescritura.

El gateway debe ser asíncrono (devolver promesas) desde el primer día, aunque `localStorage` sea síncrono. De lo contrario, al conectar un backend real hay que reescribir todas las llamadas.

### Datos de arranque

El sistema arranca con un juego de datos de ejemplo cargado desde un archivo de semilla: pipeline con sus etapas, tipos de actividad, categorías de etiquetas, un par de usuarios y unos veinte leads repartidos entre etapas y estados. Sin eso no se puede evaluar nada, sobre todo el kanban.

Debe existir además una función de reinicio que borre todo y vuelva a cargar la semilla.

### Limitaciones aceptadas de esta arquitectura

Son consecuencias conocidas de no tener backend, no defectos a resolver:

- **Los datos viven en el navegador de cada usuario.** No hay nada compartido. Dos personas usando la réplica no ven lo mismo. La asignación de leads, los equipos y los permisos se pueden *ver* funcionar, pero no se pueden probar de verdad entre varias personas.
- **`localStorage` ronda los 5 MB por dominio.** Alcanza de sobra para leads y configuración; no alcanza para adjuntos. Ver decisión abierta #4.
- **Borrar los datos del navegador borra todo.** Aceptable para una réplica de evaluación, inaceptable para producción. Este es el límite que marca el final de la Fase 1.
- **No hay notificaciones ni recordatorios reales.** Los vencimientos se calculan cuando la aplicación está abierta. No hay nada que avise a nadie con la pestaña cerrada.

### Convenciones de código

- Nombres de colecciones y campos en inglés, `snake_case`.
- Interfaz de usuario íntegramente en español rioplatense.
- Fechas y horas almacenadas en UTC, mostradas en `America/Argentina/Buenos_Aires`.
- Montos en decimal, nunca en punto flotante.
- Ids generados con UUID, no autoincrementales — evita colisiones al migrar.

---

## 8. Roles y permisos

| Rol | Alcance |
|---|---|
| Admin | Todo, incluida la configuración del sistema |
| Gerente comercial | Todos los leads, sin acceso a configuración |
| Vendedor | Solo sus leads y los de su equipo |
| Lectura | Consulta y reportes, sin edición |

Los leads sin asignar van a una bandeja separada, como en noCRM.

Recordar: en Fase 1 esto es una simulación de permisos sobre datos locales. Sirve para validar las reglas, no para confiar en ellas.

---

## 9. Datos reales desde noCRM

No es migración —no hay adónde migrar todavía— sino una forma de cargar la semilla con datos verdaderos, que es mucho mejor que inventarlos.

Dos caminos:

**Exportación CSV.** La pantalla de leads tiene botón Exportar. Es el camino más rápido y no requiere permisos de administrador.

**API v2.** Con una clave de administrador, sobre `https://<tu-cuenta>.nocrm.io/api/v2/`, header `X-API-KEY`, cuota de 2000 requests por día:

- `/pipelines`, `/steps` — configuración del pipeline
- `/fields` — campos personalizados
- `/categories?include_tags=true` — categorías y etiquetas
- `/activities` — tipos de actividad
- `/leads` — leads, paginado de a 100 con `offset`
- `/clients` — carpetas de clientes
- `/prospecting_lists` — listados de prospección
- `/users`, `/teams`

Los cuatro primeros son los que más importan: definen la configuración real de la cuenta y cierran la decisión abierta #1.

**Nota:** la extracción todavía no se hizo. Hasta que se haga, la configuración específica de CIMOMET en este documento es supuesta, no relevada.

---

## 10. Notas para Fase 3

No se construye nada de esto ahora, y **no se agregan entidades por adelantado**. Queda anotado para que las decisiones de hoy no lo bloqueen.

- **Cotizaciones.** Habrá una entidad `quotes` ligada al lead, con ítems, y varias revisiones por lead (revisión 0, 1, 2 — habitual en obra industrial). El campo `leads.amount` pasará a derivarse de la cotización vigente en lugar de cargarse a mano. Consecuencia práctica para hoy: no colgarle lógica de negocio ni validaciones a `amount` que impidan recalcularlo después.
- **Contactos.** El bloque `Campo: valor` no se sostiene para emitir cotizaciones, que necesitan un cliente con CUIT y condición frente al IVA. La normalización de contactos es una conversación de Fase 2, y el parser de §3 es justamente lo que la hace posible sin perder datos.
- **Órdenes de trabajo.** Una cotización aprobada generará una o varias OT en CIMOMET v3.
- **Unidad compartida.** Los ítems de cotización deberán expresarse en horas-operario por puesto (Corte, Armado, Soldadura, Pintura), la misma unidad con la que v3 mide capacidad. Mantener ese vocabulario evita mapeos entre sistemas.
- **Encuesta de satisfacción.** Al despachar una OT se dispara una encuesta que vuelve a Comercial y se asocia al lead de origen.
- **Dos modos de trabajo, confirmados por Ventas (2026-08-25).** La distinción Prospect/Lead de §3 se corresponde con dos modos reales de trabajo que el área comercial nombra así: "Relaciones comerciales" (tanteo general de posibles clientes, buscando que inviten a cotizar — mapea a `prospecting_lists`/`prospects`) y "Ventas" (una vez que hay una cotización concreta en danza — mapea a `leads`). Esto confirma el modelo de §3, no lo cambia.
- **Cotizaciones como módulo propio, no solo un campo del lead.** Ventas lo describe como una pantalla propia: el área de presupuestos/ingeniería (no el vendedor) carga una ficha de cotización con el PDF y datos del proyecto; el comercial entra a ese módulo y ve **todas** las cotizaciones (no solo las propias, filtrado por su alcance de todos modos), con número de proyecto, kilos, etc., y hace seguimiento de los proyectos desde ahí. Ajusta la nota de "Cotizaciones" más arriba: `quotes` va a necesitar su propia vista listada además de vivir colgada del lead.
- **Campos de cotización mencionados:** número de proyecto, kilos (peso de material — unidad distinta de las horas-operario por puesto ya anotadas para las OT), PDF adjunto.
- **Rol nuevo a incorporar en §8.** Quien confecciona la cotización es un área distinta del vendedor (presupuestos/ingeniería), sin acceso hoy a los roles de §8. Falta definir su alcance y permisos sobre `quotes` cuando se construya Fase 3.
- **Adelanto puntual (2026-09-16): módulo `home`.** A pedido explícito, se construyó ya una primera versión de esto en código — `js/modules/home/`, colecciones `buyer_events` y `buyer_notes`, campo `leads.followup_status`. Es una excepción consciente a la regla de "no innovar" de §1: reutiliza `leads` como si fueran los "proyectos/presupuestos" (agrupados por comprador tomando el primer segmento del título, `CLIENTE - Contacto - Proyecto`) en lugar de esperar a la entidad `quotes` real. Tablero Pendiente/Gestión/Resuelto + calendario de próximos contactos + historial de paneos por comprador (no por proyecto individual — ver una llamada, todos los proyectos de ese comprador). Cuando se construya `quotes` de verdad en Fase 3, este módulo hay que revisarlo: la agrupación por texto del título es una muleta, no un vínculo real a una entidad `client`/`buyer`.

---

## 11. Riesgos conocidos

- **Movilidad.** noCRM tiene app móvil. Si los vendedores lo usan desde el celular en el cliente y el reemplazo no funciona bien en móvil, no se va a adoptar. Decidir el nivel de soporte móvil antes de escribir la interfaz, no después.
- **Correo.** noCRM permite crear leads enviando un mail y archiva la correspondencia por lead. Si esa función está en uso, reemplazarla es trabajo considerable y no hay forma de replicarla sin backend.
- **El parser de descripciones.** Es el componente con más probabilidad de traer sorpresas: campos multilínea, acentos, campos vacíos, usuarios que escribieron encima del bloque. Conviene atacarlo temprano y con datos reales.
- **Adopción.** Un sistema propio sin un responsable que lo mantenga se degrada. Antes de pasar a producción tiene que haber alguien designado.

---

## 12. Decisiones abiertas

1. **Configuración real de la cuenta.** Etapas exactas y su orden, campos personalizados, categorías de etiquetas, tipos de actividad. Se resuelve con §9. Las etapas observadas son Por contactar, Contactado, Propuesta enviada y Negociación, pero la vista es desplazable y puede haber más.
2. **¿Uno o dos pipelines?** En la aplicación se ven dos botones: "Pipeline de Ventas" y "Pipeline fechas de cierre". No está claro si son dos pipelines reales o un pipeline con dos vistas. Determina si el modelo necesita soporte multi-pipeline.
3. **Idioma de los nombres de campo en el parser.** El bloque usa etiquetas visibles (`Firstname` en la documentación en inglés). Hay que confirmar cómo están en la cuenta de CIMOMET, porque el parser depende de eso literalmente.
4. **Adjuntos.** No entran en `localStorage`. Opciones: dejar solo el registro del archivo sin contenido, usar IndexedDB, o postergar los adjuntos hasta que haya backend.
5. **Integración con correo.** ¿Se usa hoy? ¿Se replica de alguna forma o se documenta como brecha conocida?
6. **Soporte móvil.** ¿Responsive básico o interfaz móvil dedicada?
7. **Nivel de detalle de la auditoría.** ¿Historial de todos los campos o solo de etapa, estado, monto y responsable?
8. **Multiempresa.** ¿El sistema debe contemplar CIMOMET y una segunda empresa vinculada por separado, como hace Nexo RRHH?
