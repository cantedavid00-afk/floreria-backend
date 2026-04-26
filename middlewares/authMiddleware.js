/**
 * MIDDLEWARE: Verificación de Token JWT
 * Protege las rutas del administrador.
 */

const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protegerRuta = async (req, res, next) => {
  try {
    // 1. Verificar que el header Authorization existe y tiene formato correcto
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado. Token requerido.' });
    }

    // 2. Extraer y verificar el token
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Distinguir entre token expirado y token inválido
      const mensaje = err.name === 'TokenExpiredError'
        ? 'Sesión expirada. Por favor inicia sesión de nuevo.'
        : 'Token inválido.';
      return res.status(401).json({ error: mensaje });
    }

    // 3. Verificar que el admin aún existe en la base de datos
    const admin = await Admin.findById(decoded.id).select('+activo');
    if (!admin || !admin.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o desactivado.' });
    }

    // 4. Adjuntar el admin al request para uso en las rutas
    req.admin = admin;
    next();

  } catch (error) {
    console.error('[AUTH MIDDLEWARE ERROR]', error.message);
    res.status(500).json({ error: 'Error interno de autenticación.' });
  }
};

module.exports = { protegerRuta };
