/**
 * RUTA: /api/login
 * Autenticación del administrador.
 */

const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();

const Admin   = require('../models/Admin');

/**
 * POST /api/login
 * Body: { usuario: string, password: string }
 * Responde con un JWT de 8 horas si las credenciales son válidas.
 */
router.post('/', async (req, res) => {
  try {
    const { usuario, password } = req.body;

    // Validación básica de entrada
    if (!usuario || !password ||
        typeof usuario !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
    }

    // Limitar longitud para prevenir ataques
    if (usuario.length > 50 || password.length > 128) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }

    // Buscar admin (incluir password explícitamente porque tiene select:false)
    const admin = await Admin.findOne({ usuario: usuario.toLowerCase() }).select('+password');

    // Respuesta genérica para no revelar si el usuario existe
    const errorCredenciales = { error: 'Usuario o contraseña incorrectos.' };

    if (!admin || !admin.activo) {
      return res.status(401).json(errorCredenciales);
    }

    const passwordValida = await admin.verificarPassword(password);
    if (!passwordValida) {
      return res.status(401).json(errorCredenciales);
    }

    // Actualizar último login
    admin.ultimoLogin = new Date();
    await admin.save();

    // Generar JWT — payload mínimo (no guardar info sensible en el token)
    const token = jwt.sign(
      { id: admin._id, usuario: admin.usuario },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      admin: { nombre: admin.nombre, usuario: admin.usuario },
    });

  } catch (error) {
    console.error('[LOGIN ERROR]', error.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
