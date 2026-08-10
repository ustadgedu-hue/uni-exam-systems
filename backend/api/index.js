// ═══════════════════════════════════════════════════════════════════════════
// API/INDEX.JS - Vercel serverless entry point
// ═══════════════════════════════════════════════════════════════════════════
//
// Vercel is file ko ek serverless function ki tarah chalata hai.
// vercel.json har request ko yahan bhejti hai, phir Express khud decide karta
// hai ke kaunsa route chalana hai.
//
// Yahan app.listen() NAHI hai — Vercel khud request handle karta hai.
//
// Database ka connection app.js ke andar middleware mein hota hai, yahan
// nahi. Wajah: agar hum yahan sab kuch rok dein to database band hone ki
// soorat mein /api/health aur CORS preflight bhi mar jate hain — aur phir
// browser mein "CORS error" aata hai jabke asal masla database ka hota hai.
// ═══════════════════════════════════════════════════════════════════════════

module.exports = require('../app');
