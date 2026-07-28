# Asistente IA de comunicacion

El ERP incluye un agente de comunicacion que convierte el contexto de Google Sheets en informacion accionable para el equipo.

## Flujo

1. El usuario abre `Asistente IA` desde la barra superior o desde la ficha de un registro.
2. El sistema identifica la pantalla y, si aplica, el registro seleccionado.
3. El backend recupera solo los modulos permitidos y limita el contexto a los registros relevantes.
4. El agente devuelve un resumen, puntos clave, riesgos, siguientes pasos y un borrador.
5. El usuario copia, revisa y decide si envia el mensaje. El agente no envia correos ni modifica Sheets.

## Configuracion segura

La funcionalidad queda desactivada por defecto hasta que la aplicacion tenga autenticacion y acceso controlado:

```env
AI_COMMUNICATION_ENABLED=false
AI_ENABLED=false
AI_INCLUDE_CONTACT_DETAILS=false
```

Despues de proteger la app, se puede activar un proveedor compatible con OpenAI:

```env
AI_COMMUNICATION_ENABLED=true
AI_ENABLED=true
AI_API_KEY=...
AI_MODEL=llama-3.1-8b-instant
AI_BASE_URL=https://api.groq.com/openai/v1
```

Tambien se acepta `GROQ_API_KEY` como nombre de variable. Groq es compatible con el endpoint de chat usado por el ERP. Su plan gratuito tiene limites de uso; no es una API ilimitada.

Si el proveedor no responde, el ERP usa un fallback local basado en los datos disponibles. Los datos de correo y telefono no se envian al proveedor salvo que `AI_INCLUDE_CONTACT_DETAILS=true`.

## Practicas incorporadas

- Contexto acotado por modulo y registro, en lugar de inyectar toda la base en el prompt.
- Datos del ERP tratados como contenido no confiable, nunca como instrucciones para el modelo.
- Respuesta estructurada para separar hechos, riesgos y acciones.
- Memoria corta de seis intercambios para mantener continuidad sin acumular contexto ilimitado.
- Fallback local para evitar una respuesta vacia ante una falla del proveedor.
- Limitacion especifica de solicitudes para controlar costo y abuso.
- Separacion entre preparar comunicacion y ejecutar una mutacion o envio.
