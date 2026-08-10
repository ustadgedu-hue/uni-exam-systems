// ═══════════════════════════════════════════════════════════════════════════
// ADMIN CONTROLLER - Admin Panel ke saare functions
// ═══════════════════════════════════════════════════════════════════════════
//
// Ye file admin ke saare API endpoints handle karti hai:
// - Dashboard statistics dikhana
// - Users (students/instructors) banana, edit karna, delete karna
// - Courses manage karna
// - Cheating reports dekhna
// - Student paper view karna
// - Orphaned data clean karna (jab exam delete kiya jaye to attempts bhi clean ho)
//
// ═══════════════════════════════════════════════════════════════════════════

const User = require('../models/User');
const Course = require('../models/Course');
const Attempt = require('../models/Attempt');
const Exam = require('../models/Exam');

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 1: getDashboard
// Purpose: Admin dashboard pe stats dikhana (kitne students, exams, etc.)
//
// Saadi misaal: Jab admin dashboard pe aata hai, ye function chalti hai
//              aur sab numbers count karke wapas bhejti hai.
//
// IMPORTANT FIX: Pehle deleted exams ke attempts bhi count ho rahe the.
//                Ab sirf wo attempts dikhayenge jin ka exam abhi exist karta hai.
// ───────────────────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    // Step 1: Sab counts parallel mein lo (saath saath taake speed acchi ho)
    const [students, instructors, exams] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'instructor' }),
      Exam.countDocuments(),
    ]);

    // Step 2: Sirf wo attempts lo jo:
    //   (a) Submit ya grade ho chuke hain
    //   (b) Jin ka exam abhi bhi exist karta hai (delete nahi hua)
    //   (c) Jin ka student abhi bhi exist karta hai
    const allAttempts = await Attempt.find({
      status: { $in: ['submitted', 'graded'] }
    })
      .sort({ submittedAt: -1 })
      .populate('student', 'name studentId')
      .populate('exam', 'title');

    // Step 3: Filter karo — sirf wo rakho jin ka exam aur student abhi exist karta hai
    // Agar exam delete ho gaya to populate('exam') null return karta hai
    const validAttempts = allAttempts.filter(a => a.exam && a.student && a.student.name);

    // Step 4: Recent 5 attempts dikhao dashboard pe
    const recent = validAttempts.slice(0, 5);

    // Step 5: Response bhejo
    res.json({
      totalStudents: students,
      totalInstructors: instructors,
      totalExams: exams,
      totalAttempts: validAttempts.length,
      recentAttempts: recent
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 2: cleanupOrphanedData
// Purpose: Database mein jo "ghost" data hai use clean karta hai.
//
// Ghost data kya hai? Misaal:
// - Exam delete ho gaya lekin uske attempts abhi tak database mein hain
// - User delete ho gaya lekin uske attempts/enrollments hain
// Ye function un sab ko delete kar deta hai.
//
// Admin frontend pe "Clean Database" button dabake ye function chala sakta hai.
// ───────────────────────────────────────────────────────────────────────────
const cleanupOrphanedData = async (req, res) => {
  try {
    let deletedCount = 0;

    // Step 1: Saare valid exam IDs lo (jo abhi exist karte hain)
    const validExamIds = await Exam.distinct('_id');
    const validUserIds = await User.distinct('_id');

    // Step 2: Wo attempts delete karo jin ka exam ya student ab exist nahi karta
    const orphanedAttempts = await Attempt.deleteMany({
      $or: [
        { exam: { $nin: validExamIds } },        // Exam delete ho gaya
        { student: { $nin: validUserIds } }      // Student delete ho gaya
      ]
    });
    deletedCount += orphanedAttempts.deletedCount;

    res.json({
      message: `Database cleaned successfully. ${deletedCount} old records removed.`,
      deletedAttempts: orphanedAttempts.deletedCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 3: getAllUsers
// Purpose: Saare users ki list lo (filtered by role, program, etc.)
// ───────────────────────────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    // URL se filters lo: /api/admin/users?role=student&program=BSCS
    const { role, program, studentId, semester } = req.query;
    const filter = {};

    // Sirf wo filters add karo jo URL mein diye gaye
    if (role) filter.role = role;
    if (program) filter.program = { $regex: program, $options: 'i' };  // i = case-insensitive
    if (studentId) filter.studentId = { $regex: studentId, $options: 'i' };
    if (semester) filter.semester = parseInt(semester);

    // Database se users lo
    const users = await User.find(filter)
      .select('-password')                                              // Password chupao
      .populate('enrolledCourses', 'courseCode courseName')             // Course names show karo
      .sort({ program: 1, semester: 1, name: 1 });                      // Sort by program, semester, name

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 4: getPrograms
// Purpose: Saare unique program names lao (BSCS, BSIT, etc.)
// Frontend pe filter tabs banane ke liye ye use hota hai.
// ───────────────────────────────────────────────────────────────────────────
const getPrograms = async (req, res) => {
  try {
    const programs = await User.distinct('program', {
      role: 'student',
      program: { $ne: null, $ne: '' }     // Empty/null wale skip karo
    });
    res.json(programs.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 5: createUser
// Purpose: Naya user banao (student/instructor/admin)
// ───────────────────────────────────────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, studentId, department, semester, program, enrolledCourses } = req.body;

    // Step 1: Check karo email ya studentId pehle se exist nahi karta
    const exists = await User.findOne({
      $or: [
        { email },
        ...(studentId ? [{ studentId }] : [])
      ]
    });
    if (exists) {
      return res.status(400).json({ message: 'Email or Student ID already exists' });
    }

    // Step 2: Naya user create karo
    // studentId sirf student role ke liye hoga, admin/instructor ke liye undefined
    const isStudent = role === 'student';
    const user = await User.create({
      name, email, password, role,
      studentId: isStudent ? (studentId || undefined) : undefined,
      department,
      semester: (isStudent && semester) ? parseInt(semester) : undefined,
      program: isStudent ? program : undefined,
      enrolledCourses: isStudent ? (enrolledCourses || []) : []
    });

    // Step 3: Response bhejo (password chupa ke)
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 6: updateUser
// Purpose: Existing user ke details update karo
// ───────────────────────────────────────────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const { name, email, department, semester, program, enrolledCourses, isActive, studentId } = req.body;

    // Step 1: User dhundo
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Step 2: Sirf wo fields update karo jo request mein aaye hain
    if (name) user.name = name;
    if (email) user.email = email;
    if (department !== undefined) user.department = department;
    if (semester !== undefined) user.semester = parseInt(semester);
    if (program !== undefined) user.program = program;
    // studentId sirf student role ke liye update hoga
    if (studentId !== undefined && user.role === 'student') user.studentId = studentId;
    if (enrolledCourses !== undefined) user.enrolledCourses = enrolledCourses;
    if (isActive !== undefined) user.isActive = isActive;

    // Step 3: Database mein save karo
    await user.save();
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 7: deleteUser
// Purpose: User ko database se delete karo + uske saare attempts bhi clean karo
// ───────────────────────────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Step 1: User ke saare attempts pehle delete karo
    await Attempt.deleteMany({ student: userId });

    // Step 2: Phir user delete karo
    await User.findByIdAndDelete(userId);

    res.json({ message: 'User and all related data deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 8: resetPassword
// Purpose: Admin koi bhi user ka password reset kar sakta hai
// ───────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = req.body.newPassword;     // pre-save hook automatically hash karega
    await user.save();
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 9: getStudentPaper
// Purpose: Kisi student ka complete paper dekho (saare answers ke saath)
//
// Sirf admin ye kar sakta hai. Instructor sirf marks dekh sakta hai,
// likhe huye answers nahi.
// ───────────────────────────────────────────────────────────────────────────
const getStudentPaper = async (req, res) => {
  try {
    // Step 1: Student dhundo studentId se
    const student = await User.findOne({ studentId: req.params.studentId })
      .select('-password')
      .populate('enrolledCourses', 'courseCode courseName');

    if (!student) {
      return res.status(404).json({ message: 'No student found with this ID' });
    }

    // Step 2: Uske saare submitted/graded attempts lo
    const attempts = await Attempt.find({
      student: student._id,
      status: { $in: ['submitted', 'graded'] }
    })
      .populate({
        path: 'exam',
        populate: { path: 'course', select: 'courseCode courseName' }
      })
      .sort({ submittedAt: -1 });

    // Step 3: Filter — sirf wo attempts rakho jin ka exam abhi exist karta hai
    const validAttempts = attempts.filter(a => a.exam);

    res.json({ student, attempts: validAttempts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// FUNCTION 10: getCheatingReports
// Purpose: Saare attempts dikhao jin mein cheating ke flags lage hue hain
// ───────────────────────────────────────────────────────────────────────────
const getCheatingReports = async (req, res) => {
  try {
    const attempts = await Attempt.find({ totalCheatingFlags: { $gt: 0 } })
      .populate('student', 'name email studentId program semester')
      .populate({
        path: 'exam',
        populate: { path: 'course', select: 'courseCode courseName' }
      })
      .sort({ totalCheatingFlags: -1 });    // Highest flags pehle

    // Filter orphaned attempts
    const valid = attempts.filter(a => a.exam && a.student);
    res.json(valid);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// COURSE MANAGEMENT FUNCTIONS
// ───────────────────────────────────────────────────────────────────────────
const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('instructor', 'name email')
      .sort({ courseCode: 1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createCourse = async (req, res) => {
  try {
    const course = await Course.create(req.body);
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteCourse = async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Export sab functions
module.exports = {
  getDashboard,
  cleanupOrphanedData,
  getAllUsers,
  getPrograms,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getStudentPaper,
  getCheatingReports,
  getAllCourses,
  createCourse,
  updateCourse,
  deleteCourse
};
