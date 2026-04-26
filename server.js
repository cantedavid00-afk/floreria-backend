require('dotenv').config();
const express       = require('express');
const mongoose      = require('mongoose');
const cors          = require('cors');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// ── Rutas ──────────────────────────────────────
const authRouter                        = require('./routes/auth');
const { productosRouter, pedidosRouter } = require('./routes/pedidos'); // ← corregido
const webhookRouter                     = require('./routes/webhook');

const app  = express();
const PORT = process.env.PORT || 4000;

// Seguridad
app.use(helmet());

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS no permitido'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser — el webhook necesita raw body
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10kb' }));

// Sanitización NoSQL
app.use(mongoSanitize());

// Rate limiting
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
});
app.use('/api/', limiterGeneral);

const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login.' },
});
app.use('/api/login', limiterAuth);

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err.message);
    process.exit(1);
  });

// Rutas
app.use('/api/productos', productosRouter);
app.use('/api/login',     authRouter);
app.use('/api/pedidos',   pedidosRouter);
app.use('/api/webhook',   webhookRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Manejador de errores
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(err.status || 500).json({
    error: err.status === 500 ? 'Error interno' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🌸 Servidor corriendo en el puerto ${PORT}`);
});
