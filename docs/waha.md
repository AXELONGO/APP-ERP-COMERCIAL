# Integracion WAHA

El apartado **Chats** usa WAHA como transporte y PostgreSQL como historial del CRM.

## Flujo

1. El servidor configura o actualiza la sesion WAHA `WAHA_SESSION`.
2. WAHA entrega eventos `message` y `message.ack` a `/api/v2/waha/webhook`.
3. El webhook crea o actualiza el contacto, la conversacion y el mensaje en PostgreSQL.
4. El usuario selecciona una conversacion desde `Chats`.
5. El CRM envia respuestas con `POST /api/sendText` de WAHA y guarda el mensaje saliente.

## Variables

```env
WAHA_BASE_URL=http://localhost:3001
WAHA_API_KEY=
WAHA_SESSION=default
WAHA_WEBHOOK_URL=https://ivory-worm-205678.hostingersite.com/api/v2/waha/webhook
WAHA_WEBHOOK_SECRET=secreto-largo
WAHA_WORKSPACE_ID=uuid-del-workspace
PUBLIC_BASE_URL=https://ivory-worm-205678.hostingersite.com
```

`WAHA_WORKSPACE_ID` vincula la sesion a un workspace del ERP. En una instalacion multiempresa, se debe usar una sesion y webhook por workspace o evolucionar esta variable a configuracion persistida por workspace.

## Conexion

1. Ejecuta WAHA en un puerto distinto al ERP.
2. Configura las variables anteriores en el servidor.
3. Inicia sesion en `Chats` con el usuario administrador del ERP.
4. Pulsa **Conectar WhatsApp**.
5. Pulsa **Mostrar QR** y escanea el codigo desde WhatsApp > Dispositivos vinculados.
6. Cuando la sesion llegue a `WORKING`, los mensajes nuevos apareceran en la bandeja.

El endpoint webhook debe ser publico para que WAHA pueda alcanzarlo. La cabecera `X-ERP-Webhook-Secret` protege el webhook cuando se configura `WAHA_WEBHOOK_SECRET`.

## Endpoints del CRM

- `GET /api/v2/waha/status`
- `POST /api/v2/waha/session/start`
- `POST /api/v2/waha/session/stop`
- `GET /api/v2/waha/qr`
- `POST /api/v2/waha/send`
- `POST /api/v2/waha/webhook`
- `GET /api/v2/conversations/:id/messages`

La implementacion sigue el patron de bandeja compartida de `ArnasDon/wacrm`, pero usa Express, PostgreSQL, tokens V2 y WAHA en lugar de Next.js, Supabase y Meta Cloud API.
