// ═══════════════════════════════════════════════════════════════════════════
// APP.JS - Express application (sirf app banata hai, chalata nahi)
// ═══════════════════════════════════════════════════════════════════════════
//
// Ye file app ko BANATI hai lekin app.listen() NAHI karti. Iski wajah:
//
//   - Local development mein  → server.js ise leke port 5000 pe listen karta hai
//   - Vercel (production) mein → api/index.js ise leke serverless function
//                                 ki tarah use karta hai (koi port nahi hota)
//
// Ek hi app, do jagah — code duplicate nahi hota.
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { describeDbError } = require('./config/dbStatus');

// ───────────────────────────────────────────────────────────────────────────
// CONFIG GUARD — galat config ke saath chupke se chalne se behtar hai
// saaf saaf fail ho jana ("fail closed")
// ───────────────────────────────────────────────────────────────────────────
const PLACEHOLDER_SECRET = 'your_super_secret_key_change_this_in_production';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Add it to .env (local) or Vercel env vars (production).');
}
if (process.env.JWT_SECRET === PLACEHOLDER_SECRET) {
  throw new Error('JWT_SECRET is still the .env.example placeholder. Set a real random secret.');
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET is too short. Use at least 32 characters (see DEPLOYMENT.md).');
}

const app = express();

// Vercel apne proxy ke peeche chalta hai. Iske bagair req.ip hamesha proxy ka
// IP dikhata hai aur rate limiting sab users ko ek hi samajh leti hai.
app.set('trust proxy', 1);

// ───────────────────────────────────────────────────────────────────────────
// CORS — sirf apni frontend ko allow karo, sab ko nahi
// ───────────────────────────────────────────────────────────────────────────
// CORS_ORIGIN mein comma se alag kar ke URLs likho, misaal:
//   CORS_ORIGIN=https://exam-frontend.vercel.app,http://localhost:3000
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowAllOrigins = allowedOrigins.includes('*');

app.use(cors({
  origin(origin, callback) {
    // Origin header nahi hai = curl, Postman, health check, ya same-origin.
    // Ye browser ka cross-site request nahi hai, isliye allow hai.
    if (!origin) return callback(null, true);
    if (allowAllOrigins || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Blocked by CORS: ${origin} is not in CORS_ORIGIN`));
  },
  credentials: true
}));

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '1mb' }));

// ───────────────────────────────────────────────────────────────────────────
// Login rate limit — password guessing mehngi ho jaye
// ───────────────────────────────────────────────────────────────────────────
// NOTE: counter har lambda instance ki apni memory mein hai, isliye ye
// brute-force ko mushkil banata hai lekin poori tarah rokta nahi. Asli hard
// limit ke liye Redis jaisa shared store chahiye (DEPLOYMENT.md dekhein).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                    // 10 login attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' }
});
app.use('/api/auth/login', loginLimiter);

// ═══════════════════════════════════════════════════════════════════════════
// YAHAN TAK KISI ROUTE KO DATABASE KI ZAROORAT NAHI
// ═══════════════════════════════════════════════════════════════════════════
//
// Health check aur CORS preflight ko database se pehle rakhna zaroori hai.
// Warna jab database band ho to /api/health bhi mar jata hai — aur wo to
// banaya hi isliye gaya tha ke bataye database ka haal kya hai.
// ───────────────────────────────────────────────────────────────────────────

// Root route — API ka koi homepage nahi hota, lekin "Cannot GET /" dekh kar
// lagta hai deployment kharab hai. Isliye ek saaf JSON jawab.
app.get('/', (req, res) => {
  res.json({
    service: 'Online Examination System API',
    documentation: 'See DEPLOYMENT.md',
    health: '/api/health',
    note: 'This is the backend API. The web app is deployed separately.'
  });
});

// Health check — deploy ke baad sab se pehle yahi test karein.
// Ye database ke BAGAIR bhi jawab deta hai, aur batata hai ke masla kahan hai.
app.get('/api/health', async (req, res) => {
  const base = {
    api: 'ok',
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })
  };

  try {
    await connectDB();
    res.json({
      status: 'API is running ✅',
      database: 'connected',
      databaseName: mongoose.connection.name,
      ...base
    });
  } catch (err) {
    const { reason, code, detail } = describeDbError(err);
    console.error('❌ Health check: database unreachable —', err.message);
    res.status(503).json({
      status: 'degraded',
      database: 'unreachable',
      reason,
      code,
      ...(detail ? { detail } : {}),
      ...base
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// ensureDb — sirf un routes par jinhein waqai database chahiye
// ───────────────────────────────────────────────────────────────────────────
// connectDB cached hai — warm lambda mein ye foran wapas aa jata hai.
// Ise har route par lagane ke bajaye sirf API routers par lagate hain, taake
// 404 aur health jaise jawab database ke haal se aazad rahein.
const ensureDb = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);   // neeche error handler isay 503 + wajah bana dega
  }
};

// ───────────────────────────────────────────────────────────────────────────
// API Routes (sab ko database chahiye)
// ───────────────────────────────────────────────────────────────────────────
app.use('/api/auth',       ensureDb, require('./routes/authRoutes'));
app.use('/api/admin',      ensureDb, require('./routes/adminRoutes'));
app.use('/api/instructor', ensureDb, require('./routes/instructorRoutes'));
app.use('/api/student',    ensureDb, require('./routes/studentRoutes'));
app.use('/api/exam',       ensureDb, require('./routes/examRoutes'));
app.use('/api/resources',  ensureDb, require('./routes/resourceRoutes'));

// Koi bhi unknown route — HTML ki jagah JSON 404 do.
// Ye database ke bagair bhi kaam karta hai.
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ───────────────────────────────────────────────────────────────────────────
// Error handler — production mein andar ki details leak nahi karta
// ───────────────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);

  // CORS reject → 403 (500 nahi), taake browser console mein wajah saaf ho
  if (err.message && err.message.startsWith('Blocked by CORS')) {
    return res.status(403).json({ message: 'CORS: this origin is not allowed to call the API' });
  }

  // Database down / reachable nahi → 503, kyunki ye client ki ghalti nahi.
  // Sath mein wajah bhi bhejte hain taake deploy ke waqt pata chale masla kya
  // hai — /api/health ki tarah.
  if (
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoParseError' ||
    (err.message && err.message.includes('MONGO_URI is not set'))
  ) {
    const { reason, code } = describeDbError(err);
    return res.status(503).json({
      message: 'Database unavailable. Please try again shortly.',
      reason,
      code
    });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    message: isProduction ? 'Internal server error' : err.message
  });
});

module.exports = app;
