# Documentación del Backend para el Dashboard (Frontend)

Esta guía detalla los endpoints REST y eventos de WebSockets (Socket.io) expuestos por el backend de Comutel Ventas, con especial foco en los SLAs (Acuerdos de Nivel de Servicio) de los vendedores.

---

## 1. Endpoints REST (API)

### `GET /api/leads`
Devuelve la lista de leads activos ordenados por fecha de creación (los más recientes primero). Este endpoint es crucial para la tabla principal del Dashboard.

**Ejemplo de un Lead en la respuesta:**
```json
[
  {
    "id": 123,
    "sendpulse_contact_id": "sp_abc123",
    "nombre": "Juan Pérez",
    "celular": "+51999888777",
    "canal": "WhatsApp",
    "campana": "Promo Verano",
    "tipo": "Académia", // 'Soporte Técnico', 'Académia', 'Ventas', etc.
    "requerimiento": "Información de equipos",
    "notas": "Llamar por la tarde",
    "vendedor_id": 5,
    "vendedor_nombre": "Carlos Asesor",
    
    "estado": "nuevo", // 'nuevo' | 'en_atencion' | 'cotizado' | 'venta_efectiva' | 'negociacion_futuro' | 'no_efectiva'
    "resultado": null, // 'ganado' | 'futuro' | 'perdido' | null
    
    // TIEMPOS (Fechas exactas del ciclo de vida del lead)
    "ts_lead_creado": "2026-03-24T10:00:00.000Z",
    "ts_efectivo": "2026-03-24T10:00:00.000Z", // Timestamp de creación ajustado a horario hábil
    "ts_primera_respuesta": null, // Se llena cuando el vendedor responde
    "ts_cotizacion_enviada": null, // Se llena cuando el vendedor envía cotización
    "ts_cierre": null,
    
    // ---------------------------------------------------------------- //
    // ⏱️ MÉTRICAS Y SLAs (En Minutos)                                  //
    // ---------------------------------------------------------------- //

    // SLA: Primera Respuesta (Tiempo desde ts_efectivo a la primera vez que el asesor responde)
    "min_primera_respuesta": null, // Si ya respondió, indica los minutos que demoró.
    "min_esperando_respuesta": 15, // [!] Si NO ha respondido, indica minutos que el lead lleva en espera hoy.
    
    // SLA: Cotización Enviada (Tiempo desde la primera respuesta al envío de la cotización)
    "min_cotizacion": null // Si ya cotizó, indica los minutos que demoró tras la 1ra respuesta.
  }
]
```

> [!TIP]
> **Para los Semáforos en la UI:** Utiliza el valor de `min_esperando_respuesta`. Si el lead está en estado `nuevo`, este valor irá subiendo. Puedes pintar de Verde (0-15m), Amarillo (15-30m) y Rojo (+30m).

### `GET /api/leads/metricas`
Devuelve las métricas agregadas por vendedor (ideal para el **Ranking de Vendedores** o **Tarjetas de Métricas**). Viene de la vista `metricas_vendedor`.

### Categorías Importantes para el Dashboard

1. **Campaña (`lead.campana`):** (e.g. "Promo Verano", "Black Friday") Determina desde qué campaña de marketing ingresó el lead.
2. **Canales (`lead.canal`):** (e.g. "WhatsApp", "Facebook Messenger", "Instagram") La fuente de tráfico o red social del contacto original.
3. **Tipo (`lead.tipo`):** Categoría principal del lead o departamento al que corresponde. El dashboard puede usar esto para agrupar o filtrar, por ejemplo:
    * `"Soporte Técnico"`
    * `"Académia"`
    * `"Ventas B2B"`
4. **SLA (Acuerdos de Nivel de Servicio):** Reflejados mediante los tiempos `min_primera_respuesta` y `min_cotizacion`, ayudan al tablero gerencial a visualizar embudos atascados.

### `PATCH /api/leads/:id/estado`
Si el Dashboard permite cerrar o cambiar el estado/resultado de los leads a los supervisores.
**Body:**
```json
{
  "estado": "venta_efectiva",
  "resultado": "ganado",
  "vendedor_id": 5
}
```

---

## 2. Eventos en Tiempo Real (Socket.io)

El frontend debe conectarse al origen del servidor (ej: `http://localhost:3000`) para recibir actualizaciones instántaneas y evitar hacer "polling" (recargar los datos constantemente).

**Conexión inicial (React):**
```javascript
import { io } from "socket.io-client";
const socket = io("http://localhost:3000"); // URL de tu backend
```

### Eventos a escuchar en el Dashboard:

#### A. `lead:nuevo`
Emitido por el Webhook de Sendpulse cuando ingresa un lead completamente nuevo.
* **Payload:** Objeto del Lead creado (estado: `'nuevo'`).
* **Acción en Frontend:** Añadir el lead al tope de la "Tabla de Leads" y actualizar contadores numéricos.

#### B. `lead:actualizado`
Emitido en tres escenarios clave:
1. El Vendedor Respondió (Cambia de `'nuevo'` a `'en_atencion'`).
2. El Vendedor Envió Cotización (Cambia de `'en_atencion'` a `'cotizado'`).
3. El estado general fue cambiado mediante API.
* **Payload:** Objeto del Lead actualizado.
* **Acción en Frontend:** Buscar el lead por ID en el array local del Dashboard y reemplazarlo para que se reflejen los nuevos tiempos (`ts_primera_respuesta`, etc) y el nuevo `estado`.

#### C. `lead:cerrado`
Emitido cuando un lead finaliza su ciclo (`'venta_efectiva'`, `'no_efectiva'`, etc).
* **Payload:** Objeto del Lead finalizado.
* **Acción en Frontend:** Quitarlo de la tabla principal de "activos" (o cambiarle el color) y actualizar el ranking de ventas/conversiones.
