# Blueprint UX/UI del ERP Conversacional

## 0. Alcance y decisiones

Este documento define la experiencia objetivo para evolucionar el ERP actual a un CRM SaaS multi-tenant para PyMEs. No propone reemplazar la operación existente: propone una capa de producto coherente encima de los módulos V2, WhatsApp/WAHA, Meta, contactos, conversaciones, notas, pipeline y cotizaciones.

### Principios de compatibilidad

- Mantener las rutas existentes `/api/v2/waha`, `/api/v2/meta`, contactos, conversaciones y cotizaciones durante la migración.
- Construir nuevas pantallas sobre servicios de dominio, no directamente sobre tablas legacy.
- Mantener `workspace_id` en la sesión, las queries, los eventos y los permisos.
- Introducir el nuevo shell gradualmente, empezando por Inbox, Dashboard y Facturación.
- Usar adaptadores para WAHA y Meta antes de añadir nuevos canales.
- No publicar una configuración de IA sin una versión explícita y rollback disponible.

## 1. Modelo mental del producto

El usuario debe entender el producto como cuatro capas coordinadas:

```text
Operación diaria   -> Inbox, contactos, tareas y citas
Conversión         -> Pipeline, cotizaciones, contratos y cobranza
Automatización     -> Agente IA, reglas, conocimiento y escalación
Control del negocio-> Dashboard, analítica, billing y permisos
```

El Inbox es el centro de trabajo. Los demás módulos deben poder abrirse desde el contexto activo:

```text
Conversación -> Contacto -> Pipeline -> Cita -> Cotización -> Contrato -> Cobranza
```

## 2. Arquitectura de información

### Sidebar definitiva

```text
Inicio
Inbox                         [pendientes]
Contactos
Embudo
Calendario

Ventas
  Cotizaciones
  Contratos
  Cobranzas

Marketing
Analítica

Agente IA
  Playground
  Conocimiento
  Reglas
  Métricas

Integraciones
Facturación y uso             [estado]
Configuración
```

### Reglas de navegación

| Nivel | Contenido | Regla |
|---|---|---|
| Primario | Inicio, Inbox, Contactos, Embudo, Calendario | Máximo siete destinos visibles antes de agrupar |
| Secundario | Cotizaciones, contratos, cobranza, conocimiento y reglas | Tabs o subnavegación del módulo |
| Contextual | Asignar, escalar, cotizar, agendar, cambiar etapa | Acciones dentro de la entidad activa |
| Administrativo | Equipo, roles, API, integraciones, billing | Visible solo con permisos y desde Configuración |
| Personal | Favoritos, vistas y dashboards | Guardado por usuario y workspace |

### Frecuencia y prioridad

| Módulo | Frecuencia | Prioridad |
|---|---:|---:|
| Inbox | Continua | P0 |
| Dashboard | Diaria | P0 |
| Contactos | Diaria | P0 |
| Embudo | Diaria | P0 |
| Ventas | Diaria | P0 |
| Calendario | Diaria | P1 |
| Agente IA | Semanal | P0 durante onboarding |
| Facturación y uso | Semanal o ante alerta | P0 |
| Analítica | Semanal | P1 |
| Marketing | Semanal | P1 |
| Integraciones | Ocasional | P1 |

## 3. Shell y layout global

### Desktop

```text
┌───────────────┬────────────────────────────────────────────┐
│ Sidebar       │ Topbar: breadcrumb, búsqueda, workspace     │
│ 240 px        ├────────────────────────────────────────────┤
│               │ SystemBanner: límites, integraciones, pagos │
│               ├──────────────────────────────┬─────────────┤
│               │ Contenido principal          │ Contexto    │
│               │                              │ 320-400 px  │
└───────────────┴──────────────────────────────┴─────────────┘
```

### Contrato del shell

| Elemento | Comportamiento |
|---|---|
| Sidebar | Expandida en desktop, colapsada en laptop, drawer en tablet/mobile |
| Topbar | Sticky, contiene workspace, búsqueda global, notificaciones y perfil |
| System banner | Debajo del topbar; persistente para estados críticos |
| Área principal | Scroll independiente; no debe mover el topbar |
| Panel contextual | Drawer en pantallas menores a 1280 px |
| Breadcrumb | Solo desde segundo nivel; no repetir el nombre del módulo actual |
| Modal | Confirmaciones, aprobación, recarga y acciones irreversibles |
| Página completa | Contratos, configuración de IA, analítica y formularios complejos |

### Banners del sistema

El banner debe usar un contrato uniforme:

```json
{
  "severity": "critical",
  "title": "Las respuestas de IA están pausadas",
  "description": "No quedan mensajes disponibles en este workspace.",
  "primaryAction": { "label": "Ir a Facturación", "href": "/billing" },
  "secondaryAction": { "label": "Ver consumo", "href": "/billing/usage" },
  "dismissible": false
}
```

Estados mínimos:

| Estado | Persistencia | Acción primaria |
|---|---|---|
| Información | Temporal | Ver detalle |
| Advertencia | Hasta resolver o descartar | Comprar recarga |
| Crítico | No descartable en Inbox | Ir a Facturación |
| Error integración | Hasta nuevo health check | Revisar integración |
| Pago fallido | Hasta confirmación del proveedor | Actualizar pago |

## 4. Dashboard

### Layout operativo

```text
Header: Buenos días, {nombre} | periodo | exportar
KPI row: chats nuevos | chats activos | citas | escalaciones
System row: estado IA y consumo | salud de canales | pagos pendientes
Work row: inbox pendiente | próximas citas | actividad reciente
Commercial row: funnel | cotizaciones | preguntas sin respuesta
```

### Tarjeta de estado IA

Debe estar en la primera fila de contenido si el estado no es `normal`.

```text
IA activa
318 mensajes disponibles
682 de 1,000 usados · 68.2%
Consumo esperado al cierre: 910
[Ver uso]
```

```text
IA pausada
No quedan mensajes disponibles. Los chats siguen entrando, pero requieren respuesta manual.
[Ir a Facturación] [Ver consumo]
```

### Dashboard por rol

| Rol | Primera fila | Segunda fila |
|---|---|---|
| Owner | Revenue, uso, estado IA, pagos | Funnel, equipo, integraciones |
| Admin | Chats, SLA, asignación, escalaciones | IA, reglas, salud operativa |
| Ventas | Leads, oportunidades, citas, cotizaciones | Pipeline y tareas |
| Soporte | Pendientes, SLA, escalaciones, sin asignar | Actividad de equipo |
| Finanzas | Cobranza, vencidos, pagos, billing | Cotizaciones y contratos |
| Analista | Funnel, conversiones, canales, uso | Exportaciones y tendencias |

## 5. Inbox conversacional

### Estructura

```text
Panel A: lista de conversaciones
  búsqueda
  vistas guardadas
  filtros
  filas de conversación

Panel B: hilo
  header del canal y estado
  mensajes
  eventos de sistema
  composer

Panel C: contacto
  datos principales
  pipeline
  cotizaciones
  recorrido
  notas
```

### Fila de conversación

Debe mostrar, en orden de prioridad:

1. Estado no leído.
2. Nombre del contacto.
3. Último mensaje.
4. Canal.
5. Tiempo desde la actividad.
6. Responsable.
7. Etapa.
8. Estado IA/SLA.

### Filtros

```text
Canal: Todos | WhatsApp | Instagram | Messenger | Widget
Estado: Abierto | Pendiente | Cerrado | Escalado
Responsable: Todos | Míos | Sin asignar | Equipo
Etapa: Todas | Nuevo | Calificado | Propuesta...
IA: Activa | Pausada | Transferida
SLA: Normal | Próximo a vencer | Vencido
```

### Acciones de productividad

- Respuestas rápidas por equipo y canal.
- Plantillas con variables del contacto.
- Atajos de teclado desktop.
- Acciones masivas sobre lista.
- Recordatorio para responder después.
- Crear tarea sin abandonar la conversación.
- Asignar a usuario o equipo.
- Mover etapa desde el header.
- Crear cita y cotización desde el composer.

### Estados del hilo

| Estado | Tratamiento |
|---|---|
| Nuevo | Badge prioritario y CTA “Asignarme” |
| IA activo | Indicador discreto en header |
| IA pausado | Banner rojo y composer humano habilitado |
| Escalado | Resumen IA fijado arriba del hilo |
| Cerrado | Composer bloqueado hasta reabrir |
| Error de envío | Mensaje con reintentar y código técnico en detalles |

## 6. Contactos, pipeline y ventas

### Ficha 360

```text
Header: avatar, nombre, empresa, teléfono, etapa, responsable
Acciones: mensaje | cita | cotización | tarea | más

Tabs:
Resumen | Conversaciones | Recorrido | Pipeline | Citas |
Cotizaciones | Contratos | Cobranza | Notas
```

### Decisión de patrón por interacción

| Interacción | Patrón |
|---|---|
| Editar nombre, email o teléfono | Drawer |
| Crear contacto rápido | Drawer |
| Fusionar duplicados | Modal de confirmación |
| Ver historial completo | Página o tab full page |
| Cambiar etapa | Popover desde tarjeta o header |
| Crear cita | Drawer en desktop, bottom sheet en mobile |
| Crear cotización sencilla | Drawer |
| Cotización compleja | Página completa |
| Editar contrato | Página completa |
| Aprobar descuento | Modal con resumen financiero |
| Cobranza masiva | Tabla con bulk actions |

### Kanban

Cada tarjeta debe mostrar únicamente lo necesario para decidir:

```text
María López
Propuesta · $18,500 MXN
Instagram · hace 3 h
Responsable: Axel
Próxima acción: enviar cotización
```

El movimiento debe mostrar un toast con “Deshacer” durante cinco segundos y crear un registro de `pipeline_movements`.

## 7. Agente IA

### Arquitectura UX

```text
Agente IA
├── Playground
├── Agente
├── Conocimiento
│   ├── Memoria
│   ├── Recursos
│   ├── P&R
│   └── Productos
├── Reglas
│   ├── Seguimientos
│   ├── Embudo
│   ├── Asignación
│   └── Escalación
├── Canales
├── Historial
└── Métricas
```

### Regla para evitar complejidad

Cada tab debe seguir esta secuencia:

```text
Estado actual → Configuración principal → Ejemplo → Opciones avanzadas → Guardar/ publicar
```

No mezclar en el mismo panel prompt, documentos, límites de uso y credenciales.

### Configuración mínima del agente

- Nombre.
- Objetivo.
- Tono.
- Prompt del sistema.
- Horario de atención.
- Canales activos.
- Base de conocimiento publicada.
- Herramientas permitidas.
- Reglas de escalación.
- Límite de costo o mensajes.

### Playground

El simulador debe indicar qué se está probando:

```text
Canal: Instagram
Agente: Ventas v4
Contacto: Nuevo contacto
Conocimiento: 12 documentos publicados
Saldo simulado: 100 mensajes
```

Debe poder mostrar eventos de herramienta de forma resumida:

```text
Consultó catálogo de productos
Encontró 3 resultados
Propuso crear una cita
```

## 8. Facturación, uso y límites

### Modelo visual

La pantalla debe priorizar el estado, no la complejidad financiera.

```text
Estado IA: PAUSADA
Mensajes disponibles: 0
Uso del periodo: 1,000 / 1,000
Proyección: límite alcanzado

[Comprar recarga] [Cambiar plan]
```

### Secciones

1. Estado actual.
2. Mensajes disponibles.
3. Consumo por periodo.
4. Consumo por agente.
5. Consumo diario.
6. Consumo por canal.
7. Excedentes.
8. Planes y recargas.
9. Historial de billing.
10. Eventos de pausa y reactivación.

### Consumo por canal

| Canal | Mensajes | Porcentaje | Estado |
|---|---:|---:|---|
| WhatsApp | 650 | 65% | Normal |
| Instagram | 280 | 28% | Normal |
| Messenger | 70 | 7% | Normal |
| Widget | 0 | 0% | No configurado |

### Proyección

Mostrar una proyección solo cuando exista suficiente histórico. Si no hay datos:

```text
Aún no hay suficiente historial para proyectar tu consumo.
```

La proyección debe indicar el supuesto utilizado y no presentarse como certeza.

## 9. Design system

### Densidad

Usar tres niveles configurables:

| Densidad | Uso |
|---|---|
| Compacta | Inbox, tablas operativas y analítica |
| Normal | Configuración y formularios |
| Cómoda | Onboarding y configurador IA |

### Componentes críticos

| Componente | Requisito funcional |
|---|---|
| `SystemBanner` | CTA, persistencia y severidad |
| `UsageMeter` | Usado, límite, reservado y disponible |
| `ConversationRow` | Canal, IA, SLA, asignación y no leído |
| `MessageComposer` | Plantillas, adjuntos, canal y modo IA/humano |
| `RuleBuilder` | Lenguaje natural más representación estructurada |
| `Timeline` | Actor, fecha, fuente y acción reversible cuando aplique |
| `PermissionMatrix` | Checkbox por recurso y acción |
| `IntegrationHealth` | Estado, último check y acción correctiva |
| `EmptyState` | Explicación y CTA específica |
| `SkeletonTable` | Mantener la geometría del contenido final |

### Accesibilidad mínima

- Contraste WCAG AA.
- Focus visible.
- Navegación por teclado en tablas e Inbox.
- No depender solo del color para estados.
- Labels explícitos en formularios.
- Errores asociados al campo.
- Confirmaciones anunciadas por screen reader.

## 10. Roles y personalización

### Owner y Admin

Ven todos los módulos, el estado completo de billing, uso por agente, integraciones y permisos. Pueden publicar el agente y reactivar IA.

### Ventas

Inicio enfocado en leads, pipeline, citas y cotizaciones. No ve credenciales de integración ni configuración avanzada de billing.

### Soporte

Inicio enfocado en Inbox, SLA y escalaciones. Puede responder y reasignar, pero no publicar prompts ni modificar planes.

### Finanzas

Inicio enfocado en cobranza, cotizaciones, contratos y pagos. Ve consumo y billing, pero no necesita Playground.

### Analista

Ve Dashboard y Analítica, con exportación limitada por permisos. No puede editar contactos, mensajes ni configuración.

### Personalización

- Favoritos en sidebar.
- Vistas guardadas por usuario o equipo.
- Columnas configurables.
- Filtros persistentes en URL.
- Dashboard por rol.
- Densidad de tablas.
- Tema claro/oscuro opcional.
- Canal predeterminado del composer.

## 11. Responsive y mobile

### Mapa de transformación

| Desktop | Mobile |
|---|---|
| Sidebar | Menú hamburguesa o navegación inferior |
| Tres paneles Inbox | Lista → hilo → detalle como navegación secuencial |
| Panel contextual | Bottom sheet |
| Kanban completo | Columnas horizontales o selector de etapa |
| Tabla | Cards con campos prioritarios |
| Modal ancho | Página o bottom sheet |
| Filtros laterales | Bottom sheet persistido |
| Composer fijo | Composer sobre teclado |

### Barra inferior mobile

```text
Inbox | Contactos | Embudo | Calendario | Más
```

El indicador de IA pausada debe permanecer visible en el topbar o como banner sticky. Facturación no debe quedar escondida dentro de “Más” cuando el workspace está bloqueado.

### Acciones prioritarias mobile

- Responder.
- Asignar.
- Escalar.
- Crear cita.
- Mover etapa.
- Ver saldo.
- Comprar recarga.

## 12. Entrega y handoff

### Fases UX/UI

| Fase | Pantallas | Resultado |
|---|---|---|
| P0 | Shell, Dashboard, Inbox, Contact drawer, banner IA, Billing | Operación diaria coherente |
| P1 | Pipeline, Contacto 360, Cotizaciones, Calendario | Flujo comercial integrado |
| P1 | Playground, Agente, Memoria, P&R, Productos | Configuración IA comprensible |
| P2 | Reglas, Automatizaciones, Contratos, Cobranza | Operación escalable |
| P2 | Analítica, Marketing, Attribution | Medición comercial |
| P3 | Mobile avanzada, dashboards personalizados, marketplace | Escalabilidad de producto |

### Entregables de Figma

- Variables de color, tipografía, spacing y radius.
- Componentes con variantes y estados.
- Layout desktop, laptop, tablet y mobile.
- Prototipo del flujo de Inbox.
- Prototipo de pausa y reactivación de IA.
- Prototipo de creación y publicación de agente.
- Prototipo de lead a cotización.
- Matriz de visibilidad por rol.
- Flujos de error y estados vacíos.
- Especificación de eventos de analytics.

### Criterios de aceptación

- Un asesor puede responder un chat sin abandonar Inbox.
- Puede ver contacto, etapa y cotizaciones en el mismo contexto.
- Una conversación escalada conserva el resumen generado por IA.
- Un admin ve mensajes disponibles, consumo por agente y consumo diario.
- Cuando el saldo llega a cero, el banner aparece en Dashboard, Inbox y Agente IA.
- El CTA de la alerta lleva directamente a Facturación.
- Después de una recarga válida, el admin puede reactivar la IA.
- Un miembro sin permiso no ve acciones de configuración ni billing.
- Todas las pantallas tienen loading, empty, error y forbidden state.
- El uso móvil permite responder, asignar, escalar y revisar saldo.
- Las rutas existentes de WAHA, Meta, contactos y cotizaciones continúan funcionando.

### Métricas UX iniciales

| Métrica | Objetivo inicial |
|---|---:|
| Tiempo para responder un chat | < 30 segundos |
| Tiempo para asignar un chat | < 10 segundos |
| Tiempo para encontrar un contacto | < 15 segundos |
| Tiempo para crear una cita | < 60 segundos |
| Tiempo para generar cotización | < 3 minutos |
| Usuarios que entienden una pausa IA | > 90% en prueba moderada |
| Usuarios que encuentran Facturación desde alerta | > 95% |
| Errores de navegación por permisos | 0 acciones ejecutadas sin autorización |

### Orden de implementación

1. Tokens y componentes base.
2. App shell y permisos de navegación.
3. System banners y estado IA.
4. Inbox de tres paneles.
5. Contact drawer y ficha 360.
6. Pipeline y acciones contextuales.
7. Billing/usage y pausa de IA.
8. Cotizaciones y calendario.
9. Playground y conocimiento.
10. Reglas y automatizaciones.
11. Analítica y marketing.
12. Mobile y personalización avanzada.

La primera versión debe optimizar el trabajo que ocurre cada minuto: **recibir, entender, asignar, responder y convertir una conversación**. La configuración avanzada y los dashboards deben crecer alrededor de ese flujo, no competir con él.
