// ═══════════════════════════════════════════════════════════════════════════
// DB.JS - MongoDB connection (serverless-safe)
// ═══════════════════════════════════════════════════════════════════════════
//
// Vercel par har API request ek alag "lambda" mein chal sakti hai. Agar hum
// har request pe naya mongoose.connect() karein to database pe sainkdon
// connections khul jayenge aur Atlas free tier ki limit khatam ho jayegi.
//
// Isliye hum connection ka PROMISE globalThis pe cache karte hain. Warm lambda
// dobara wahi connection use karta hai — naya nahi banata.
//
// Saadi misaal: Ek hi phone call line baar baar use karna, har baar naya
//              number dial karne ke bajaye.
// ═══════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

// Cache ko globalThis pe rakho — module dobara load ho to bhi zinda rahe
let cached = globalThis._mongooseCache;
if (!cached) {
  cached = globalThis._mongooseCache = { conn: null, promise: null };
}

const connectDB = async () => {
  // Pehle se connected hain? Wahi wapas do.
  if (cached.conn) return cached.conn;

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Add it to .env (local) or Vercel env vars (production).');
  }

  // Connection abhi ban raha hai? Usi promise ka intezaar karo.
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI, {
      // Serverless mein request ka waqt limited hai — jaldi fail karo,
      // 30 second tak chup chaap intezaar mat karo
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Failed promise ko cache mein mat chhodo, warna agli request bhi
    // usi purani failure ko dobara throw karti rahegi
    cached.promise = null;
    throw err;
  }

  return cached.conn;
};

module.exports = connectDB;
