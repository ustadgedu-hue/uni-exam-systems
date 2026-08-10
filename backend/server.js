// ═══════════════════════════════════════════════════════════════════════════
// SERVER.JS - Local development entry point
// ═══════════════════════════════════════════════════════════════════════════
//
// Ye file SIRF local development ke liye hai (npm run dev / npm start).
// Production (Vercel) par api/index.js chalti hai — wahan koi port nahi hota.
//
// Yahan ka kaam sirf 2 cheezein hain:
//   1. MongoDB se connect karo
//   2. app.js ka Express app leke port pe listen karo
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    console.log('✅ MongoDB connected successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Test URL: http://localhost:${PORT}/api/health`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('   Check: Is MONGO_URI correct in .env?');
    console.error('   Atlas users: is your IP allowed under Network Access?');
    process.exit(1);
  });
