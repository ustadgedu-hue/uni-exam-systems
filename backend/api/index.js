// ═══════════════════════════════════════════════════════════════════════════
// API/INDEX.JS - Vercel serverless entry point
// ═══════════════════════════════════════════════════════════════════════════
//
// Vercel is file ko ek serverless function ki tarah chalata hai.
// vercel.json har request ko yahan bhejti hai, phir Express khud decide karta
// hai ke kaunsa route chalana hai.
//
// Yahan app.listen() NAHI hai — Vercel khud request handle karta hai.
// ═══════════════════════════════════════════════════════════════════════════

const app = require('../app');
const connectDB = require('../config/db');

module.exports = async (req, res) => {
  try {
    // Har request se pehle connection ready karo. connectDB cached hai,
    // isliye warm lambda mein ye foran wapas aa jata hai.
    await connectDB();
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return res.status(503).json({ message: 'Database unavailable. Please try again shortly.' });
  }

  return app(req, res);
};
