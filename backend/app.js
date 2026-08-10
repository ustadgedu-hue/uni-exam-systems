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
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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

// ───────────────────────────────────────────────────────────────────────────
// API Routes
// ───────────────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/authRoutes'));
app.use('/api/admin',      require('./routes/adminRoutes'));
app.use('/api/instructor', require('./routes/instructorRoutes'));
app.use('/api/student',    require('./routes/studentRoutes'));
app.use('/api/exam',       require('./routes/examRoutes'));
app.use('/api/resources',  require('./routes/resourceRoutes'));

// Health check — deploy ke baad sab se pehle yahi test karein
app.get('/api/health', (req, res) => {
  res.json({
    status: 'API is running ✅',
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })
  });
});

// Koi bhi unknown /api route — HTML ki jagah JSON 404 do
app.use('/api', (req, res) => {
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

  // Database down / reachable nahi → 503, kyunki ye client ki ghalti nahi
  if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError') {
    return res.status(503).json({ message: 'Database unavailable. Please try again shortly.' });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    message: isProduction ? 'Internal server error' : err.message
  });
});

module.exports = app;
