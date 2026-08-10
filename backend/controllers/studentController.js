// ═══════════════════════════════════════════════════════════════════════════
// STUDENT CONTROLLER - Student ke API endpoints
// ═══════════════════════════════════════════════════════════════════════════
//
// Student panel ke functions yahan hain:
//   1. Apni results dekho (jo exam de chuke ho)
//   2. Detailed paper dekho (grading hone ke baad)
//   3. Apni profile dekho
//
// IMPORTANT FIX: Ab agar koi exam delete ho gaya hai, to uska attempt
//                student ke results mein nahi dikhe ga.
// ═══════════════════════════════════════════════════════════════════════════

const Attempt = require('../models/Attempt');
const User = require('../models/User');

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 1: getMyResults
// Purpose: Student ke saare results lo (jo submit ya grade ho chuke hain)
// Route:   GET /api/student/results
// ───────────────────────────────────────────────────────────────────────────
const getMyResults = async (req, res) => {
  try {
    // Step 1: Saare attempts lo jo student ne submit kiye hain
    const attempts = await Attempt.find({
      student: req.user._id,
      status: { $in: ['submitted', 'graded'] }
    })
      .populate({
        path: 'exam',
        populate: { path: 'course', select: 'courseCode courseName' }
      })
      .sort({ submittedAt: -1 });    // Latest pehle

    // Step 2: FILTER — sirf wo attempts rakho jin ka exam abhi exist karta hai
    // Agar exam delete ho gaya hai to populate('exam') null return karta hai
    const validAttempts = attempts.filter(a => a.exam !== null);

    res.json(validAttempts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 2: getMyPaper
// Purpose: Apna paper detail mein dekho (grading hone ke baad)
// Route:   GET /api/student/results/:attemptId
// ───────────────────────────────────────────────────────────────────────────
const getMyPaper = async (req, res) => {
  try {
    // Step 1: Attempt dhundo
    const attempt = await Attempt.findById(req.params.attemptId)
      .populate({
        path: 'exam',
        populate: { path: 'course', select: 'courseCode courseName' }
      });

    // Step 2: Errors check karo
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    if (!attempt.exam) {
      return res.status(404).json({ message: 'The exam for this attempt has been deleted' });
    }

    // Step 3: Confirm karo ke ye attempt isi student ka hai
    if (attempt.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot view this paper' });
    }

    // Step 4: Agar exam abhi in-progress hai to paper nahi dikhana
    if (attempt.status === 'in_progress') {
      return res.status(400).json({ message: 'Exam has not been submitted yet' });
    }

    res.json(attempt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 3: getProfile
// Purpose: Apni profile + enrolled courses dekho
// Route:   GET /api/student/profile
// ───────────────────────────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const student = await User.findById(req.user._id)
      .select('-password')           // Password mat bhejo
      .populate('enrolledCourses');  // Course details bhi laao

    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getMyResults, getMyPaper, getProfile };
