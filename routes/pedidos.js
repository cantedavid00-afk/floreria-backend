/**
 * RUTAS: Productos y Pedidos
 * GET  /api/productos         → Catálogo público
 * POST /api/pedidos           → Crear pedido + preferencia Mercado Pago
 * GET  /api/pedidos           → Dashboard admin (protegido)
 * PATCH /api/pedidos/:id      → Actualizar estado (protegido)
 */

const express    = require('express');
const axios      = require('axios');
const mongoose   = require('mongoose');
const router     = express.Router();

const Producto   = require('../models/Producto');
const Pedido     = require('../models/Pedido');
const { protegerRuta } = require('../middlewares/authMiddleware');

// =============================================
// PRODUCTOS — Público
// =============================================

/**
 * GET /api/productos
 * Devuelve el catálogo de productos disponibles.
 * Soporta filtro por categoria: ?categoria=ramo
 */
const productosRouter = require('express').Router();

productosRouter.get('/', async (req, res) => {
  try {
    const filtro = { disponible: true };

    // Whitelist de categorías para evitar inyección
    const categoriasPermitidas = ['ramo', 'arreglo', 'planta', 'extra'];
    if (req.query.categoria && categoriasPermitidas.includes(req.query.categoria)) {
      filtro.categoria = req.query.categoria;
    }

    const productos = await Producto
      .find(filtro)
      .select('-__v -stock')     // No exponer stock al público
      .sort({ createdAt: -1 })
      .lean();                   // .lean() para respuesta más rápida (sin métodos Mongoose)

    res.json({ ok: true, total: productos.length, productos });

  } catch (error) {
    console.error('[GET /productos]', error.message);
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
});

// =============================================
// PEDIDOS — Crear (Público con validaciones)
// =============================================

/**
 * POST /api/pedidos
 * Crea un pedido PENDIENTE y genera una preferencia de Mercado Pago.
 * Retorna la URL de pago de MP (init_point) para redirigir al cliente.
 */
const pedidosRouter = require('express').Router();

pedidosRouter.post('/', async (req, res) => {
  try {
    const { cliente, entrega, ramoId, extrasIds } = req.body;

    // ── Validación básica ──────────────────────────────
    if (!cliente?.nombre || !cliente?.email || !cliente?.telefono) {
      return res.status(400).json({ error: 'Datos del cliente incompletos.' });
    }
    if (!entrega?.calle || !entrega?.codigoPostal || !entrega?.fechaEntrega) {
      return res.status(400).json({ error: 'Datos de entrega incompletos.' });
    }
    if (!mongoose.Types.ObjectId.isValid(ramoId)) {
      return res.status(400).json({ error: 'ID de ramo inválido.' });
    }

    // ── Validar CP de cobertura en el servidor ─────────
    // (Esta validación TAMBIÉN existe en el frontend, pero el backend es la fuente de verdad)
    const CP_COBERTURA = require('../config/codigosPostales');
    if (!CP_COBERTURA.includes(entrega.codigoPostal)) {
      return res.status(400).json({
        error: 'Solo realizamos entregas en la zona local (Apizaco y alrededores).',
      });
    }

    // ── Obtener productos de la DB (precio oficial) ────
    const ramo = await Producto.findOne({ _id: ramoId, disponible: true, esExtra: false });
    if (!ramo) return res.status(404).json({ error: 'Ramo no encontrado o no disponible.' });

    let extrasDB = [];
    if (extrasIds && Array.isArray(extrasIds) && extrasIds.length > 0) {
      // Validar que todos los IDs sean ObjectId válidos
      const idsValidos = extrasIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      extrasDB = await Producto.find({
        _id: { $in: idsValidos },
        esExtra: true,
        disponible: true,
      });
    }

    // ── Calcular totales desde la DB (NUNCA desde el cliente) ──
    const COSTO_ENVIO  = 80; // MXN — ajusta según tu zona
    const subtotalRamo = ramo.precio;
    const subtotalExtras = extrasDB.reduce((acc, e) => acc + e.precio, 0);
    const subtotal     = subtotalRamo + subtotalExtras;
    const total        = subtotal + COSTO_ENVIO;

    // ── Crear el pedido en DB (estado: pendiente) ──────
    const nuevoPedido = await Pedido.create({
      cliente: {
        nombre:   String(cliente.nombre).substring(0, 100),
        telefono: String(cliente.telefono).substring(0, 20),
        email:    String(cliente.email).substring(0, 200).toLowerCase(),
      },
      entrega: {
        calle:        String(entrega.calle).substring(0, 200),
        numero:       String(entrega.numero || 'S/N').substring(0, 20),
        colonia:      String(entrega.colonia || '').substring(0, 100),
        ciudad:       String(entrega.ciudad || 'Apizaco').substring(0, 100),
        codigoPostal: entrega.codigoPostal,
        fechaEntrega: new Date(entrega.fechaEntrega),
        horaEntrega:  String(entrega.horaEntrega || 'Sin especificar').substring(0, 50),
        instrucciones: String(entrega.instrucciones || '').substring(0, 300),
      },
      ramo: {
        productoId: ramo._id,
        nombre:     ramo.nombre,
        precio:     ramo.precio,
      },
      extras: extrasDB.map(e => ({
        productoId: e._id,
        nombre:     e.nombre,
        precio:     e.precio,
        cantidad:   1,
      })),
      subtotal,
      costoEnvio: COSTO_ENVIO,
      total,
    });

    // ── Crear preferencia en Mercado Pago ──────────────
    const items = [
      {
        id:          ramo._id.toString(),
        title:       ramo.nombre,
        quantity:    1,
        unit_price:  ramo.precio,
        currency_id: 'MXN',
      },
      ...extrasDB.map(e => ({
        id:          e._id.toString(),
        title:       e.nombre,
        quantity:    1,
        unit_price:  e.precio,
        currency_id: 'MXN',
      })),
      {
        id:          'envio',
        title:       'Costo de Envío',
        quantity:    1,
        unit_price:  COSTO_ENVIO,
        currency_id: 'MXN',
      },
    ];

    const preferencia = {
      items,
      payer: {
        name:  cliente.nombre,
        email: cliente.email,
        phone: { number: cliente.telefono },
      },
      external_reference: nuevoPedido._id.toString(), // Clave para identificar el pedido en el webhook
      notification_url: `${process.env.BACKEND_URL}/api/webhook`,
      back_urls: {
        success: `${process.env.FRONTEND_URL}/pago-exitoso.html`,
        failure: `${process.env.FRONTEND_URL}/pago-fallido.html`,
        pending: `${process.env.FRONTEND_URL}/pago-pendiente.html`,
      },
      auto_return: 'approved',
      statement_descriptor: 'FLORERIA LOCAL',
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to:   new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hora
    };

    const { data: mpResponse } = await axios.post(
      'https://api.mercadopago.com/checkout/preferences',
      preferencia,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    // Guardar el ID de la preferencia MP en el pedido
    nuevoPedido.pago.mpPreferenceId = mpResponse.id;
    await nuevoPedido.save();

    // Responder con la URL de pago (sandbox o producción)
    const urlPago = process.env.NODE_ENV === 'production'
      ? mpResponse.init_point
      : mpResponse.sandbox_init_point;

    res.status(201).json({
      ok: true,
      pedidoId:  nuevoPedido._id,
      urlPago,
    });

  } catch (error) {
    console.error('[POST /pedidos]', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al procesar el pedido.' });
  }
});

// =============================================
// PEDIDOS — Dashboard Admin (Protegido)
// =============================================

/**
 * GET /api/pedidos
 * Devuelve todos los pedidos, ordenados por fecha de entrega.
 * Requiere JWT válido.
 */
pedidosRouter.get('/', protegerRuta, async (req, res) => {
  try {
    const { estado, pagina = 1, limite = 20 } = req.query;
    const filtro = {};

    const estadosValidos = ['recibido', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'];
    if (estado && estadosValidos.includes(estado)) {
      filtro.estadoPedido = estado;
    }

    const skip  = (parseInt(pagina) - 1) * parseInt(limite);
    const total = await Pedido.countDocuments(filtro);

    const pedidos = await Pedido.find(filtro)
      .sort({ 'entrega.fechaEntrega': 1 }) // Más próximos primero
      .skip(skip)
      .limit(parseInt(limite))
      .select('-__v')
      .lean();

    res.json({ ok: true, total, pagina: parseInt(pagina), pedidos });

  } catch (error) {
    console.error('[GET /pedidos]', error.message);
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
});

/**
 * PATCH /api/pedidos/:id
 * Actualiza el estado de un pedido (ej. "en_camino").
 */
pedidosRouter.patch('/:id', protegerRuta, async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoPedido } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const estadosValidos = ['recibido', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(estadoPedido)) {
      return res.status(400).json({ error: 'Estado no válido.' });
    }

    const pedido = await Pedido.findByIdAndUpdate(
      id,
      { estadoPedido },
      { new: true, runValidators: true }
    );

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

    res.json({ ok: true, pedido });

  } catch (error) {
    console.error('[PATCH /pedidos/:id]', error.message);
    res.status(500).json({ error: 'Error al actualizar pedido.' });
  }
});

module.exports = { productosRouter, pedidosRouter };
