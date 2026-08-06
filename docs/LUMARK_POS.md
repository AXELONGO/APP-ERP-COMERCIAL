# LUMARK POS

## Integración

El POS se integra en la arquitectura activa de `APP-ERP-COMERCIAL`:

- Entrada: `server.js` delega en `app/server.js`.
- Rutas POS: `app/routes/pos.js`.
- Interfaz: `public/index.html`, `public/app.js` y `public/style.css`.
- Persistencia: Google Sheets.
- Eventos: `N8N_POS_WEBHOOK_URL`, con fallback al motor de movimientos existente.
- Alcance: un negocio y una sucursal.

La migración no se ejecuta automáticamente durante el arranque. Con credenciales válidas puedes crear las pestañas de forma idempotente:

```bash
SPREADSHEET_ID="..." GOOGLE_CREDENTIALS="..." npm run migrate:pos
```

Para cargar datos ficticios de Café Aurora, sin reemplazar filas existentes:

```bash
SPREADSHEET_ID="..." GOOGLE_CREDENTIALS="..." npm run seed:pos-demo
```

La primera fila de cada pestaña se valida antes de escribir.

| Pestaña | Encabezados |
| --- | --- |
| `POS_Productos` | `ID Producto`, `SKU`, `Codigo de barras`, `Nombre`, `Descripcion`, `Categoria ID`, `Marca`, `Proveedor`, `Tipo`, `Precio venta`, `Costo`, `Impuesto`, `Unidad`, `Foto URL`, `Stock minimo`, `Variantes JSON`, `Activo` |
| `POS_Categorias` | `ID Categoria`, `Nombre`, `Color`, `Icono`, `Activo` |
| `POS_Inventario` | `ID Movimiento`, `Producto ID`, `Tipo`, `Cantidad`, `Stock anterior`, `Stock actual`, `Motivo`, `Venta ID`, `Actor`, `Fecha` |
| `POS_Ventas` | `ID Venta`, `Estado`, `Subtotal`, `Descuento`, `Impuestos`, `Total`, `Metodo de pago`, `Efectivo recibido`, `Cambio`, `Empleado ID`, `Caja ID`, `Correlacion ID`, `Fecha`, `Actor` |
| `POS_DetalleVentas` | `ID Detalle`, `Venta ID`, `Producto ID`, `SKU`, `Producto`, `Cantidad`, `Precio unitario`, `Descuento`, `Impuesto`, `Total` |
| `POS_Clientes` | `ID Cliente`, `Nombre`, `Telefono`, `Correo`, `Fecha de nacimiento`, `Puntos`, `Segmento`, `Fecha de registro` |
| `POS_Empleados` | `ID Empleado`, `Nombre`, `Rol`, `PIN Hash`, `Activo`, `Fecha de registro` |
| `POS_CorteCaja` | `ID Corte`, `Estado`, `Apertura`, `Cierre`, `Ventas`, `Retiros`, `Gastos`, `Efectivo esperado`, `Efectivo contado`, `Diferencia` |
| `POS_Gastos` | `ID Gasto`, `Caja ID`, `Concepto`, `Monto`, `Motivo`, `Actor`, `Fecha` |
| `POS_Configuracion` | `ID Configuracion`, `Clave`, `Valor`, `Tipo` |

## API

Todos los catálogos tienen CRUD bajo `/api/pos_<modulo>`. El flujo de venta usa:

```text
POST /api/pos/checkout
```

Operaciones adicionales:

- `GET /api/pos/inventory/low`
- `POST /api/pos/inventory/adjust`
- `POST /api/pos/caja/open`
- `POST /api/pos/caja/expense`
- `POST /api/pos/caja/close`

La venta se crea como `Pendiente`, agrega detalle y movimientos de inventario, y cambia a `Confirmada` solo después de recibir confirmación de Google Sheets. Si falla, queda en `Error` y el frontend no muestra éxito.

Ejemplo:

```json
{
  "items": [{ "productoId": "POS-PROD-0001", "cantidad": 2 }],
  "metodoPago": "Efectivo",
  "efectivoRecibido": 200,
  "actor": "cajero",
  "correlacionId": "POS-operacion-unica"
}
```

Métodos válidos: `Efectivo`, `Tarjeta`, `Transferencia`, `Mercado Pago` y `Mixto`.

## Evento n8n

La venta confirmada emite un evento con `record_id`, `previous_value`, `new_value`, `actor`, `persistence_result` y `correlation_id`. Configura `N8N_POS_WEBHOOK_URL` con el flujo hermano `pos-events` y aplica idempotencia por `correlation_id` en n8n.

## Seguridad y pendientes

- No guardar PIN sin hash.
- No subir `.env`, `credentials.json`, `GOOGLE_CREDENTIALS` ni tokens.
- Confirmar permisos de la cuenta de servicio antes de crear pestañas.
- El MVP incluye catálogo, carrito, cobro, cambio, inventario, ajustes, clientes, empleados, apertura/cierre de caja y reportes básicos.
- Quedan para la siguiente iteración: devoluciones autorizadas, impresión térmica, tickets por WhatsApp/correo, variantes y combos, importación CSV, PIN operativo, CFDI 4.0 y Mercado Pago real.

## Datos demo

La carga demo está en `docs/LUMARK_POS_DEMO.csv` y también puede ejecutarse con `npm run seed:pos-demo`. Nunca se ejecuta durante el arranque del ERP.

## Rollback

El rollback de código se realiza con `git revert <commit-pos>` y reconstrucción del contenedor. No borres las pestañas POS al revertir código y revisa ventas en estado `Pendiente` o `Error` antes de reintentar.
