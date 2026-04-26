/**
 * =============================================
 * FLORERÍA LOCAL — SERVIDOR PRINCIPAL
 * Backend: Node.js + Express + MongoDB Atlas
 * Autor: Full-Stack Senior Dev
 * =============================================
 */

require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// ── Rutas ──────────────────────────────────────
const productosRouter = require('./routes/productos');
const authRouter      = require('./routes/auth');
const pedidosRouter   = require('./routes/pedidos');
const webhookRouter   = require('./routes/webhook');

const app  = express();
const PORT = process.env.PORT || 4000;

// =============================================
// SEGURIDAD: Cabeceras HTTP seguras con Helmet
// =============================================
app.use(helmet());

// =============================================
// CORS: Solo permite el origen del Frontend
// =============================================
const allowedOrigins = [
  process.env.FRONTEND_URL,       // https://tu-floreria.vercel.app
  'http://localhost:3000',        // desarrollo local
];
app.use(cors({
  origin: (origin, callback) => {
    // Permite llamadas sin origin (Postman, webhooks server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS no permitido para este origen'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// =============================================
// BODY PARSER
// El webhook de Mercado Pago necesita raw body,
// por eso se registra ANTES del JSON global.
// =============================================
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10kb' }));  // límite para evitar ataques DoS

// =============================================
// SANITIZACIÓN: Previene inyección NoSQL
// Remueve $ y . de los objetos de entrada
// =============================================
app.use(mongoSanitize());

// =============================================
// RATE LIMITING GLOBAL
// =============================================
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
});
app.use('/api/', limiterGeneral);

// Rate limiter más estricto para autenticación
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
});
app.use('/api/login', limiterAuth);

// =============================================
// CONEXIÓN A MONGODB ATLAS
// =============================================
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => {
  console.error('❌ Error conectando a MongoDB:', err.message);
  process.exit(1); // Termina el proceso si no hay DB
});

// =============================================
// REGISTRO DE RUTAS
// =============================================
app.use('/api/productos', productosRouter);
app.use('/api/login',     authRouter);
app.use('/api/pedidos',   pedidosRouter);
app.use('/api/webhook',   webhookRouter);

// Health check para que Render sepa que está vivo
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// =============================================
// MANEJADOR DE ERRORES GLOBAL
// =============================================
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor' : err.message,
  });
});

// =============================================
// INICIAR SERVIDOR
// =============================================
app.listen(PORT, () => {
  console.log(`🌸 Servidor de Florería corriendo en el puerto ${PORT}`);
});
