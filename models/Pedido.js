/**
 * MODELO: Pedido
 * Registra cada orden de compra confirmada por Mercado Pago.
 * El servidor NUNCA almacena datos de tarjeta. Solo IDs de pago.
 */

const mongoose = require('mongoose');

// Sub-esquema para los extras del pedido
const ExtraSchema = new mongoose.Schema({
  productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
  nombre:     { type: String, required: true },
  precio:     { type: Number, required: true },
  cantidad:   { type: Number, default: 1, min: 1 },
}, { _id: false });

const PedidoSchema = new mongoose.Schema({
  // ── Datos del cliente ──────────────────────────────
  cliente: {
    nombre:    { type: String, required: true, trim: true, maxlength: 100 },
    telefono:  { type: String, required: true, trim: true, maxlength: 20 },
    email:     {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Email no válido'],
    },
  },

  // ── Dirección de entrega ───────────────────────────
  entrega: {
    calle:     { type: String, required: true, trim: true },
    numero:    { type: String, required: true, trim: true },
    colonia:   { type: String, required: true, trim: true },
    ciudad:    { type: String, required: true, trim: true },
    codigoPostal: { type: String, required: true, match: [/^\d{5}$/, 'CP inválido'] },
    fechaEntrega: { type: Date, required: true },
    horaEntrega:  { type: String, default: 'Sin especificar' },
    instrucciones: { type: String, maxlength: 300, default: '' },
  },

  // ── Productos ──────────────────────────────────────
  ramo: {
    productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
    nombre:     { type: String, required: true },
    precio:     { type: Number, required: true },
  },
  extras: [ExtraSchema],

  // ── Costos ────────────────────────────────────────
  subtotal:    { type: Number, required: true, min: 0 },
  costoEnvio:  { type: Number, required: true, default: 0 },
  total:       { type: Number, required: true, min: 0 },

  // ── Pago (Mercado Pago) ────────────────────────────
  // NUNCA se guarda info de tarjeta. Solo el ID de la transacción.
  pago: {
    estado: {
      type: String,
      enum: ['pendiente', 'aprobado', 'rechazado', 'reembolsado'],
      default: 'pendiente',
    },
    mpPreferenceId: { type: String, default: null }, // ID de la preferencia MP
    mpPaymentId:    { type: String, default: null }, // ID del pago confirmado
    metodoPago:     { type: String, default: null }, // 'credit_card', 'debit_card', etc.
    fechaPago:      { type: Date, default: null },
  },

  // ── Estado del pedido ──────────────────────────────
  estadoPedido: {
    type: String,
    enum: ['recibido', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'],
    default: 'recibido',
  },

  // ── Notificaciones ─────────────────────────────────
  whatsappEnviado: { type: Boolean, default: false },

}, { timestamps: true });

// Índices para el dashboard del admin
PedidoSchema.index({ 'entrega.fechaEntrega': 1 });
PedidoSchema.index({ 'pago.estado': 1 });
PedidoSchema.index({ estadoPedido: 1 });

module.exports = mongoose.model('Pedido', PedidoSchema);
