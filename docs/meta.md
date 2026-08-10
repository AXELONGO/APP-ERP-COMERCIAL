# Integración Meta Business

El ERP admite una conexión nativa preparada para Messenger e Instagram Professional mediante Meta Graph API.

## URL del webhook

```text
https://chatbot-erp.or7bqd.easypanel.host/api/v2/meta/webhook?workspace_id=WORKSPACE_UUID
```

La URL OAuth configurada en Meta debe coincidir con el campo `redirectUri` guardado en la integración Meta. El callback del ERP es:

```text
https://chatbot-erp.or7bqd.easypanel.host/api/v2/meta/oauth/callback
```

## Configuración

1. Crea una app en Meta for Developers.
2. Agrega Facebook Login for Business, Webhooks, Messenger e Instagram Graph API.
3. Guarda `appId`, `appSecret`, `redirectUri`, `webhookUrl` y `verifyToken` en Integraciones > Meta Business.
4. Pulsa Conectar con Meta y autoriza el Business Portfolio.
5. Configura el webhook de Meta para los objetos Page e Instagram.
6. Suscribe los eventos de mensajes de Messenger e Instagram.

Los tokens se cifran en `integration_configs`. Los eventos se registran en `meta_webhook_events` y los mensajes se guardan en las tablas V2 existentes con canales `messenger` e `instagram`.

## Requisitos de Meta

- Página de Facebook administrada por el Business Portfolio.
- Cuenta de Instagram Professional vinculada a la página.
- Permisos aprobados para `pages_messaging` e `instagram_manage_messages` en producción.
- El `workspace_id` debe formar parte de la URL del webhook para una instalación multiempresa.
