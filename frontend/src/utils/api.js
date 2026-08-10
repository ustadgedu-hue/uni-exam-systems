// ═══════════════════════════════════════════════════════════════════════════
// API UTILITY - Backend ke saath baat karne ke liye axios instance
// ═══════════════════════════════════════════════════════════════════════════
//
// Axios ek HTTP client library hai. Iska use kar ke frontend backend ko
// request bhejti hai (login, exam start, results, etc.).
//
// Ye file ek custom axios instance banati hai jisme:
//   1. Base URL automatically lag jata hai (har request mein full URL na likhna pade)
//   2. JWT token automatically request mein add ho jata hai
//   3. Agar 401 Unauthorized error aaye to user ko login pe redirect kar diya jata hai
//
// Saadi misaal: API.get('/admin/dashboard') automatically banta hai:
//                http://localhost:5000/api/admin/dashboard (with token)
// ═══════════════════════════════════════════════════════════════════════════

import axios from 'axios';

// ─── BASE URL ────────────────────────────────────────────────────────────
// Pehle .env file se lo, agar nahi mile to localhost use karo
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ─── AXIOS INSTANCE BANAO ────────────────────────────────────────────────
// timeout: 30 seconds — agar request 30s mein complete na ho to fail kar do
const API = axios.create({
  baseURL: API_URL,
  timeout: 30000
});

// ─── REQUEST INTERCEPTOR ─────────────────────────────────────────────────
// Har outgoing request se PEHLE ye chalti hai
// Ye automatically Authorization header add karti hai
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── RESPONSE INTERCEPTOR ────────────────────────────────────────────────
// Har incoming response ke baad ye chalti hai
// Agar 401 Unauthorized error aaye (token expire ya invalid) to:
//   1. localStorage clear karo
//   2. User ko login page pe redirect karo
API.interceptors.response.use(
  (res) => res,    // Success — kuch nahi karna, response wapas bhejo
  (err) => {
    if (err.response?.status === 401) {
      // Token expire ya invalid hai
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Login page pe redirect karo (lekin agar already wahan hain to nahi)
      // Iss check se infinite loop nahi hota
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);    // Error wapas bhejo (component handle karega)
  }
);

export default API;
