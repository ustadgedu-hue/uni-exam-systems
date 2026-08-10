// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES - Saare /api/admin/* URLs yahan define hote hain
// ═══════════════════════════════════════════════════════════════════════════
//
// Express Router ek mini-app hai jo specific URLs handle karta hai.
// Misaal: GET /api/admin/dashboard → getDashboard function chalata hai
//
// Har URL ke do hisse hote hain:
//   1. Path (/dashboard, /users, etc.)
//   2. Function (controller se import kiya hua)
//
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

// Middleware import — har request pe pehle authentication check hota hai
const { protect, authorize } = require('../middleware/auth');

// Controller functions import
const {
  getDashboard,
  cleanupOrphanedData,        // ← NAYA: orphan data clean karne ke liye
  getAllUsers, getPrograms,
  createUser, updateUser, deleteUser, resetPassword,
  getStudentPaper, getCheatingReports,
  getAllCourses, createCourse, updateCourse, deleteCourse
} = require('../controllers/adminController');

// ───────────────────────────────────────────────────────────────────────────
// IMPORTANT: Ye line har route pe lagti hai
// "protect" → JWT token check karta hai (logged in hona chahiye)
// "authorize('admin')" → user ka role admin hona chahiye
// ───────────────────────────────────────────────────────────────────────────
router.use(protect, authorize('admin'));

// ── DASHBOARD ROUTES ──────────────────────────────────────────────────────
router.get('/dashboard', getDashboard);
router.post('/cleanup', cleanupOrphanedData);    // ← NAYA: orphan data clean

// ── USER MANAGEMENT ROUTES ────────────────────────────────────────────────
router.get('/users',                getAllUsers);
router.get('/programs',             getPrograms);
router.post('/users',               createUser);
router.put('/users/:id',            updateUser);
router.delete('/users/:id',         deleteUser);
router.put('/users/:id/reset-password', resetPassword);

// ── STUDENT PAPER & CHEATING REPORTS ──────────────────────────────────────
router.get('/student-paper/:studentId', getStudentPaper);
router.get('/cheating-reports',          getCheatingReports);

// ── COURSE MANAGEMENT ROUTES ──────────────────────────────────────────────
router.get('/courses',           getAllCourses);
router.post('/courses',          createCourse);
router.put('/courses/:id',       updateCourse);
router.delete('/courses/:id',    deleteCourse);

module.exports = router;
