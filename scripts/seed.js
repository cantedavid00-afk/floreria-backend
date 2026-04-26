/**
 * SCRIPT: Seed de base de datos
 * Crea un administrador inicial y productos de ejemplo.
 * 
 * USO: node scripts/seed.js
 * (Solo correr una vez en configuración inicial)
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Admin    = require('../models/Admin');
const Producto = require('../models/Producto');

const PRODUCTOS_EJEMPLO = [
  // ── Ramos ────────────────────────────────────
  {
    nombre: 'Ramo Rosas Rojas Clásico',
    descripcion: '12 rosas rojas premium con follaje verde y papel kraft artesanal. El regalo perfecto para expresar amor.',
    precio: 350,
    categoria: 'ramo',
    imagenUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
    disponible: true,
    esExtra: false,
  },
  {
    nombre: 'Bouquet Primaveral Mixto',
    descripcion: 'Girasoles, gerberas y flores de temporada en una explosión de color y alegría.',
    precio: 280,
    categoria: 'ramo',
    imagenUrl: 'https://images.unsplash.com/photo-1490750967868-88df5691166a?w=600',
    disponible: true,
    esExtra: false,
  },
  {
    nombre: 'Ramo Rosa Pastel Romántico',
    descripcion: 'Rosas en tonos pastel con limonium y eucalipto. Elegante y delicado para cualquier ocasión.',
    precio: 420,
    categoria: 'ramo',
    imagenUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600',
    disponible: true,
    esExtra: false,
  },
  {
    nombre: 'Ramo de Lilas y Tulipanes',
    descripcion: 'Combinación exclusiva de tulipanes y lilas, envueltos en papel vegetal francés.',
    precio: 390,
    categoria: 'ramo',
    imagenUrl: 'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=600',
    disponible: true,
    esExtra: false,
  },

  // ── Arreglos ──────────────────────────────────
  {
    nombre: 'Arreglo Centro de Mesa Tropical',
    descripcion: 'Heliconias, anturios y hojas tropicales en un florero de vidrio. Ideal para eventos.',
    precio: 650,
    categoria: 'arreglo',
    imagenUrl: 'https://images.unsplash.com/photo-1455582916367-25f75bfc6710?w=600',
    disponible: true,
    esExtra: false,
  },
  {
    nombre: 'Caja de Rosas Premium',
    descripcion: '24 rosas premium en caja negra de lujo. La presentación más elegante de nuestra colección.',
    precio: 850,
    categoria: 'arreglo',
    imagenUrl: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=600',
    disponible: true,
    esExtra: false,
  },

  // ── Plantas ───────────────────────────────────
  {
    nombre: 'Planta Suculenta en Maceta',
    descripcion: 'Colección de 3 suculentas en maceta de barro pintada a mano. Regalo duradero y sin complicaciones.',
    precio: 180,
    categoria: 'planta',
    imagenUrl: 'https://images.unsplash.com/photo-1459156212016-c812468e2115?w=600',
    disponible: true,
    esExtra: false,
  },

  // ── Extras (upselling) ────────────────────────
  {
    nombre: 'Caja de Chocolates Lindt',
    descripcion: 'Surtido de 12 bombones Lindt premium.',
    precio: 120,
    categoria: 'extra',
    imagenUrl: '',
    disponible: true,
    esExtra: true,
  },
  {
    nombre: 'Globo de Helio "Te Amo"',
    descripcion: 'Globo metálico con mensaje personalizable.',
    precio: 60,
    categoria: 'extra',
    imagenUrl: '',
    disponible: true,
    esExtra: true,
  },
  {
    nombre: 'Tarjeta de Felicitación',
    descripcion: 'Tarjeta artesanal con sobre, escrita a mano con tu mensaje.',
    precio: 35,
    categoria: 'extra',
    imagenUrl: '',
    disponible: true,
    esExtra: true,
  },
  {
    nombre: 'Peluche Oso Mediano',
    descripcion: 'Oso de peluche suave, 30cm. El complemento perfecto para tu ramo.',
    precio: 150,
    categoria: 'extra',
    imagenUrl: '',
    disponible: true,
    esExtra: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // ── Crear administrador ───────────────────────
    const adminExistente = await Admin.findOne({ usuario: 'admin' });
    if (!adminExistente) {
      await Admin.create({
        usuario:  'admin',
        password: 'FloresAdmin2025!',  // ⚠️ Cambia esto antes de producción
        nombre:   'Administrador Florería',
      });
      console.log('✅ Admin creado: usuario=admin, password=FloresAdmin2025!');
      console.log('⚠️  CAMBIA LA CONTRASEÑA INMEDIATAMENTE EN PRODUCCIÓN');
    } else {
      console.log('ℹ️  El admin ya existe, se omitió.');
    }

    // ── Crear productos ───────────────────────────
    const totalProductos = await Producto.countDocuments();
    if (totalProductos === 0) {
      await Producto.insertMany(PRODUCTOS_EJEMPLO);
      console.log(`✅ ${PRODUCTOS_EJEMPLO.length} productos creados.`);
    } else {
      console.log(`ℹ️  Ya existen ${totalProductos} productos. Seed omitido.`);
    }

    console.log('\n🌸 Seed completado exitosamente.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en seed:', error.message);
    process.exit(1);
  }
}

seed();
