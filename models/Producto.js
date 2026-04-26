/**
 * MODELO: Producto
 * Representa un ramo de flores o artículo del catálogo.
 */

const mongoose = require('mongoose');

const ProductoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres'],
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    trim: true,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres'],
  },
  precio: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio no puede ser negativo'],
  },
  categoria: {
    type: String,
    enum: ['ramo', 'arreglo', 'planta', 'extra'],
    required: true,
  },
  imagenUrl: {
    type: String,
    required: [true, 'La URL de imagen es obligatoria'],
    // Solo permite URLs de dominios confiables (CDN propio o Cloudinary)
    match: [/^https?:\/\/.+/, 'La URL debe ser válida'],
  },
  disponible: {
    type: Boolean,
    default: true,
  },
  // Los "extras" (chocolates, globos, tarjetas) son productos con categoria='extra'
  esExtra: {
    type: Boolean,
    default: false,
  },
  stock: {
    type: Number,
    default: 99,
    min: 0,
  },
}, { timestamps: true });

// Índice para búsquedas rápidas por categoría y disponibilidad
ProductoSchema.index({ categoria: 1, disponible: 1 });

module.exports = mongoose.model('Producto', ProductoSchema);
