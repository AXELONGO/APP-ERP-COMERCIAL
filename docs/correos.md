# Módulo Correos

## Configuración OAuth

El módulo usa un token separado en `gmail-token.json` y el scope mínimo:

```text
https://www.googleapis.com/auth/gmail.send
```

Configura las variables sin guardar secretos en Git:

```env
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=https://TU_DOMINIO/api/auth/gmail/callback
GMAIL_MAX_RECIPIENTS_PER_CAMPAIGN=500
GMAIL_SEND_DELAY_MS=100
```

La URI exacta de callback debe estar registrada en el cliente OAuth de Google. Después abre `/api/auth/gmail` para autorizar la cuenta.

## Pantalla

- Editor central: asunto, HTML y texto plano.
- Panel lateral: prospectos existentes, búsqueda y selección múltiple.
- El selector excluye prospectos sin correo y conserva `prospect_id`.
- El botón de envío muestra enviados y fallidos.

## Modelo de campaña

```json
{
  "campaign_id": "CMP-...",
  "subject": "Asunto",
  "html_body": "<p>Contenido</p>",
  "text_body": "Contenido",
  "recipients": [
    { "name": "Nombre", "email": "persona@example.com", "prospect_id": "PRO-001" }
  ],
  "status": "borrador|enviando|enviada|error",
  "send_stats": { "total": 1, "sent": 1, "failed": 0, "errors": [] }
}
```

Las campañas se guardan en la pestaña independiente `Campañas Gmail`, sin alterar la pestaña existente `Campañas de Correo`.

## Envío

El backend envía un mensaje MIME `multipart/alternative` por destinatario mediante `users.messages.send`. Esto evita exponer la lista de prospectos entre sí y permite registrar fallos individuales. El límite de campaña y la pausa entre mensajes son configurables con las variables anteriores. Los errores de Gmail, incluidos cuota, límite y direcciones inválidas, quedan en `send_stats.errors`.
