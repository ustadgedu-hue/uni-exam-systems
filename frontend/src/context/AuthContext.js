// ═══════════════════════════════════════════════════════════════════════════
// AUTH CONTEXT - Authentication state management
// ═══════════════════════════════════════════════════════════════════════════
//
// Ye file React Context API use karti hai taake login/logout functionality
// aur user info SAARE components mein available ho.
//
// Bina context ke, har component ko props pass karne padte hain. Context se
// hum globally state share kar sakte hain.
//
// Ye file kya provide karti hai:
//   1. user — current logged-in user ki info
//   2. login() — login karne ka function
//   3. logout() — logout karne ka function
//   4. loading — initial check ho raha hai ya nahi
//
// JWT (JSON Web Token) kya hai?
//   - Server password check karke ek special "token" deta hai
//   - Hum is token ko localStorage mein save karte hain
//   - Har API request mein ye token bhejte hain (proof k hum logged in hain)
//   - Token 7 din ke baad expire ho jata hai
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useState, useContext, useEffect } from 'react';
import API from '../utils/api';

// Step 1: Context create karo
const AuthContext = createContext();

// ─── PROVIDER COMPONENT ─────────────────────────────────────────────────
// Ye component App.js mein wrap kiya gaya hai
// children = saari child components (saari pages)
export const AuthProvider = ({ children }) => {
  // ─── STATE ─────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);          // Logged-in user
  const [loading, setLoading] = useState(true);    // Initial load check

  // ─── INITIAL LOAD CHECK ────────────────────────────────────────────────
  // App start hote hi check karo: localStorage mein token hai ya nahi?
  // Agar hai to user ko already logged-in maan lo (page refresh mein logout na ho)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        // localStorage mein user data JSON string mein hota hai
        // Use parse karke object banao.
        // Token ki fikar mat karo — utils/api.js ka request interceptor
        // har request mein khud localStorage se token laga deta hai.
        setUser(JSON.parse(userData));
      } catch (e) {
        // Agar localStorage corrupt hai to clear kar do
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);    // Loading complete
  }, []);    // [] = sirf ek baar chalo (mount pe)

  // ─── LOGIN FUNCTION ────────────────────────────────────────────────────
  // Email aur password leke backend ko bhejta hai
  const login = async (email, password) => {
    // Step 1: Backend ko login request bhejo
    const res = await API.post('/auth/login', { email, password });

    // Step 2: Token aur user data localStorage mein save karo.
    // Agli request pe api.js ka interceptor yahi token utha lega.
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data));

    // Step 3: State mein user save karo
    setUser(res.data);

    // Step 4: User object wapas bhejo (LoginPage redirect ke liye use karega)
    return res.data;
  };

  // ─── LOGOUT FUNCTION ───────────────────────────────────────────────────
  const logout = () => {
    // localStorage clear karo — interceptor ko ab koi token nahi milega
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // State mein user null kar do
    setUser(null);
  };

  // ─── CONTEXT VALUES PROVIDE KARO ───────────────────────────────────────
  // Ye saari values har child component ko available hongi useAuth() se
  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── CUSTOM HOOK ─────────────────────────────────────────────────────────
// Components yahaan se context access karte hain
// Misaal: const { user, login } = useAuth();
export const useAuth = () => useContext(AuthContext);
