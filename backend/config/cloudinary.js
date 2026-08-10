// ═══════════════════════════════════════════════════════════════════════════
// CLOUDINARY.JS - File storage configuration
// ═══════════════════════════════════════════════════════════════════════════
//
// Pehle files backend/uploads/ folder mein save hoti thi. Vercel par ye kaam
// nahi karta — wahan ka filesystem read-only hai aur har request ke baad mit
// jata hai. Isliye ab saari files Cloudinary par jati hain.
//
// Files browser se SEEDHA Cloudinary jati hain (backend ke through nahi),
// kyunki Vercel ki serverless function 4.5MB se bari request body accept nahi
// karti. Backend sirf ek signature deta hai jo upload ko authorize karta hai.
// ═══════════════════════════════════════════════════════════════════════════

const { v2: cloudinary } = require('cloudinary');

const REQUIRED_VARS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

// Kya Cloudinary configure hai? Agar nahi to resource routes 503 dengi,
// baaki app (login, exams, results) theek chalti rahegi.
const isConfigured = () => REQUIRED_VARS.every(v => !!process.env[v]);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Saari files 'raw' ke tor pe store hoti hain (pdf/jpg/png sab) — is se
// Cloudinary file ko badalne ki koshish nahi karta, jaisi hai waisi rehti hai.
const RESOURCE_TYPE = 'raw';

// 'private' ka matlab: file ka aam CDN link kaam NAHI karta (401 milta hai).
// Download sirf us signed link se hota hai jo backend banata hai aur jo thori
// der baad khud khatam ho jata hai.
//
// Is se do faide hain:
//   1. File asli mein mehfooz hai — sirf logged-in user hi le sakta hai
//   2. Cloudinary ki "restricted media types" setting aari nahi aati
const DELIVERY_TYPE = 'private';

// Signed download link kitni der chalta hai (seconds)
const DOWNLOAD_URL_TTL = 5 * 60;

const UPLOAD_FOLDER = 'exam_system/resources';

module.exports = {
  cloudinary, isConfigured, REQUIRED_VARS,
  RESOURCE_TYPE, DELIVERY_TYPE, DOWNLOAD_URL_TTL, UPLOAD_FOLDER
};
