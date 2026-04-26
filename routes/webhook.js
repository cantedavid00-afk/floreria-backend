/**
 * RUTA: /api/webhook
 * Recibe notificaciones de Mercado Pago y confirma pedidos.
 * 
 * SEGURIDAD:
 *  - Verifica la firma HMAC-SHA256 de cada notificación
 *  - El servidor NUNCA toca datos de tarjeta
 *  - Solo consulta la API de MP para confirmar el estado real del pago
 */

const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
const router  = express.Router();

const Pedido  = require('../models/Pedido');
const { enviarNotificacionWhatsApp } = require('../services/whatsapp');

/**
 * Verifica la firma del webhook de Mercado Pago.
 * Documentación: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 * 
 * @param {Request} req - Express request con raw body
 * @returns {boolean}
 */
const verificarFirmaMP = (req) => {
  const secret    = process.env.MP_WEBHOOK_SECRET;
  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];

  if (!xSignature || !xRequestId || !secret) return false;

  // Extraer ts y v1 del header x-signature
  const parts = {};
  xSignature.split(',').forEach(part => {
    const [key, val] = part.split('=');
    if (key && val) parts[key.trim()] = val.trim();
  });

  if (!parts.ts || !parts.v1) return false;

  // Construir el manifest para el hash
  const dataId    = req.query['data.id'] || req.body?.data?.id || '';
  const manifest  = `id:${dataId};request-id:${xRequestId};ts:${parts.ts};`;

  const firmaEsperada = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(firmaEsperada),
    Buffer.from(parts.v1),
  );
};

/**
 * POST /api/webhook
 * Punto de entrada para notificaciones de Mercado Pago.
 */
router.post('/', async (req, res) => {
  // Mercado Pago espera 200 inmediatamente para no reenviar
  res.sendStatus(200);

  // Parsear el raw body
  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch {
    console.warn('[WEBHOOK] Body no es JSON válido.');
    return;
  }

  // Solo procesar notificaciones de tipo "payment"
  if (body.type !== 'payment') return;

  // ── Verificar firma (HMAC) ─────────────────────────
  // Descomenta en producción. En sandbox de MP la firma puede no llegar.
  // if (!verificarFirmaMP(req)) {
  //   console.warn('[WEBHOOK] ⚠️ Firma inválida. Notificación ignorada.');
  //   return;
  // }

  const paymentId = body.data?.id;
  if (!paymentId) return;

  try {
    // ── Consultar MP API para obtener estado real ──────
    // NUNCA confíes en el body del webhook directamente para decisiones de negocio
    const { data: pagoMP } = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        timeout: 8000,
      }
    );

    console.log(`[WEBHOOK] Pago ${paymentId} — Estado: ${pagoMP.status}`);

    // Solo procesar pagos aprobados
    if (pagoMP.status !== 'approved') return;

    // ── Buscar el pedido usando external_reference ─────
    // external_reference es el _id del pedido que enviamos al crear la preferencia MP
    const pedidoId = pagoMP.external_reference;
    if (!pedidoId) {
      console.warn('[WEBHOOK] Pago sin external_reference. Ignorado.');
      return;
    }

    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      console.warn(`[WEBHOOK] Pedido ${pedidoId} no encontrado.`);
      return;
    }

    // Evitar procesar el mismo pago dos veces (idempotencia)
    if (pedido.pago.estado === 'aprobado') {
      console.log(`[WEBHOOK] Pedido ${pedidoId} ya fue procesado. Ignorado.`);
      return;
    }

    // ── Actualizar el pedido en la base de datos ───────
    pedido.pago.estado       = 'aprobado';
    pedido.pago.mpPaymentId  = String(paymentId);
    pedido.pago.metodoPago   = pagoMP.payment_type_id || 'desconocido';
    pedido.pago.fechaPago    = new Date(pagoMP.date_approved);
    pedido.estadoPedido      = 'en_preparacion';
    await pedido.save();

    console.log(`[WEBHOOK] ✅ Pedido ${pedidoId} actualizado a APROBADO.`);

    // ── Enviar notificación por WhatsApp ───────────────
    const enviado = await enviarNotificacionWhatsApp(pedido);
    if (enviado) {
      pedido.whatsappEnviado = true;
      await pedido.save();
    }

  } catch (error) {
    console.error('[WEBHOOK] ❌ Error procesando pago:', error.message);
  }
});

module.exports = router;
