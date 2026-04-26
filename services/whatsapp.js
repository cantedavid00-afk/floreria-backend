/**
 * SERVICIO: WhatsApp Cloud API (Meta)
 * Envía notificación al administrador cuando se confirma un pago.
 * 
 * Requisitos previos:
 *  - Cuenta en Meta for Developers
 *  - App con WhatsApp Business API habilitada
 *  - Token de acceso permanente (System User)
 *  - Número de teléfono registrado y verificado
 *  - Plantilla de mensaje aprobada (o modo sandbox para pruebas)
 */

const axios = require('axios');

/**
 * Formatea pesos mexicanos
 * @param {number} cantidad
 * @returns {string} ej. "$350.00"
 */
const formatearPrecio = (cantidad) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cantidad);

/**
 * Formatea una fecha a texto legible en español
 * @param {Date|string} fecha
 * @returns {string} ej. "lunes 14 de julio de 2025"
 */
const formatearFecha = (fecha) =>
  new Date(fecha).toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

/**
 * Construye el cuerpo del mensaje WhatsApp para el admin.
 * Usa texto plano con formato de WhatsApp (*negrita*, _cursiva_).
 * 
 * NOTA: Si usas una plantilla aprobada por Meta, sustituye este
 * texto por los parámetros de tu plantilla.
 * 
 * @param {Object} pedido - Documento Mongoose de Pedido
 * @returns {string}
 */
const construirMensaje = (pedido) => {
  const extrasTexto = pedido.extras && pedido.extras.length > 0
    ? pedido.extras.map(e => `  • ${e.nombre} x${e.cantidad} — ${formatearPrecio(e.precio)}`).join('\n')
    : '  (Sin extras)';

  return `🌸 *NUEVO PEDIDO CONFIRMADO* 🌸

*N° Pedido:* ${pedido._id}
*Fecha de pago:* ${formatearFecha(pedido.pago.fechaPago)}

─────────────────────
👤 *CLIENTE*
Nombre: ${pedido.cliente.nombre}
Tel: ${pedido.cliente.telefono}
Email: ${pedido.cliente.email}

─────────────────────
📦 *PEDIDO*
🌹 Ramo: ${pedido.ramo.nombre} — ${formatearPrecio(pedido.ramo.precio)}
🎁 Extras:
${extrasTexto}

─────────────────────
🚚 *ENTREGA*
Dirección: ${pedido.entrega.calle} ${pedido.entrega.numero}, Col. ${pedido.entrega.colonia}
Ciudad: ${pedido.entrega.ciudad} CP ${pedido.entrega.codigoPostal}
📅 Fecha: ${formatearFecha(pedido.entrega.fechaEntrega)}
🕐 Hora: ${pedido.entrega.horaEntrega}
📝 Nota: ${pedido.entrega.instrucciones || 'Ninguna'}

─────────────────────
💳 *PAGO*
Total: *${formatearPrecio(pedido.total)}*
Subtotal: ${formatearPrecio(pedido.subtotal)}
Envío: ${formatearPrecio(pedido.costoEnvio)}
ID Mercado Pago: ${pedido.pago.mpPaymentId}
Estado: ✅ APROBADO

¡Prepara el arreglo a tiempo! 💐`;
};

/**
 * Envía un mensaje de WhatsApp al administrador de la florería.
 * 
 * @param {Object} pedido - Documento Mongoose completo del pedido
 * @returns {Promise<boolean>} true si fue exitoso, false si falló
 */
const enviarNotificacionWhatsApp = async (pedido) => {
  const { WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, WA_ADMIN_PHONE } = process.env;

  // Validar variables de entorno críticas
  if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN || !WA_ADMIN_PHONE) {
    console.error('[WHATSAPP] Variables de entorno de WhatsApp no configuradas.');
    return false;
  }

  const url = `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`;
  const mensaje = construirMensaje(pedido);

  // Payload para la API de WhatsApp Cloud (mensaje de texto libre)
  // ⚠️ Para producción: usa una plantilla (template) aprobada por Meta.
  // Los mensajes de texto libre solo funcionan si el cliente escribió
  // al negocio en las últimas 24h (ventana de conversación).
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: WA_ADMIN_PHONE,        // ej. "521234567890" (con código de país, sin +)
    type: 'text',
    text: {
      preview_url: false,
      body: mensaje,
    },
  };

  try {
    const respuesta = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 segundos de timeout
    });

    console.log(`[WHATSAPP] ✅ Mensaje enviado. ID: ${respuesta.data?.messages?.[0]?.id}`);
    return true;

  } catch (error) {
    // Log detallado del error sin exponer el token
    const errData = error.response?.data || error.message;
    console.error('[WHATSAPP] ❌ Error al enviar mensaje:', JSON.stringify(errData));
    return false;
  }
};

module.exports = { enviarNotificacionWhatsApp };
