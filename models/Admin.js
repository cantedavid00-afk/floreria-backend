/**
 * MODELO: Admin
 * Usuario administrador del panel. La contraseña NUNCA se guarda
 * en texto plano; se hashea con bcrypt antes de guardar.
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  usuario: {
    type: String,
    required: [true, 'El usuario es obligatorio'],
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 50,
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [8, 'Mínimo 8 caracteres'],
    // select: false oculta el campo al hacer queries normales
    select: false,
  },
  nombre: {
    type: String,
    required: true,
    trim: true,
  },
  activo: {
    type: Boolean,
    default: true,
  },
  ultimoLogin: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// ── HOOK PRE-SAVE: Hashear contraseña ─────────────
AdminSchema.pre('save', async function(next) {
  // Solo hashea si la contraseña fue modificada
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12); // 12 rondas = buen balance seguridad/velocidad
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── MÉTODO DE INSTANCIA: Verificar contraseña ─────
AdminSchema.methods.verificarPassword = async function(passwordIngresado) {
  return await bcrypt.compare(passwordIngresado, this.password);
};

module.exports = mongoose.model('Admin', AdminSchema);
