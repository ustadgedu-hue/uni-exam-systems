// ═══════════════════════════════════════════════════════════════════════════
// AUTH CONTROLLER - Login aur user authentication ka backend logic
// ═══════════════════════════════════════════════════════════════════════════
//
// Ye file 2 functions provide karti hai:
//   1. login    - User login karta hai (email/password se)
//   2. getMe    - Logged-in user ki profile info bhejta hai
//
// JWT (JSON Web Token) Workflow:
//   - User correct password deta hai
//   - Server ek token generate karta hai (signed with secret key)
//   - Token user ko diya jata hai
//   - User har subsequent request mein ye token bhejta hai
//   - Server token verify karke confirm karta hai user kaun hai
//   - Token 7 din ke baad expire ho jata hai
// ═══════════════════════════════════════════════════════════════════════════

const User = require('../models/User');
const jwt = require('jsonwebtoken');

// JWT token generate karne ka helper function
// User ID ko encode karta hai aur secret se sign karta hai
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION: login
// Route:    POST /api/auth/login
// Purpose:  User ka email aur password check karke JWT token bhejna
// ───────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Step 1: Empty fields check karo
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Step 2: User dhundo email se
    const user = await User.findOne({ email });

    // Step 3: User exist karta hai aur password match karta hai check karo
    // matchPassword method User model mein defined hai (bcrypt compare karta hai)
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Step 4: Check karo account active hai (admin ne deactivate to nahi kiya)
    if (!user.isActive) {
      return res.status(401).json({ message: 'Your account has been deactivated' });
    }

    // Step 5: Sab sahi hai — JWT token generate karke wapas bhejo
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      semester: user.semester,
      program: user.program,
      department: user.department,
      token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION: getMe
// Route:    GET /api/auth/me
// Purpose:  Currently logged-in user ki profile dena (token ke base pe)
// ───────────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  // req.user already set hota hai protect middleware mein (auth.js)
  const user = await User.findById(req.user._id)
    .select('-password')           // Password chupao
    .populate('enrolledCourses');  // Course details bhi populate karo

  res.json(user);
};

module.exports = { login, getMe };
