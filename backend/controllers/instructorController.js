const Exam = require('../models/Exam');
const Attempt = require('../models/Attempt');
const Course = require('../models/Course');
const User = require('../models/User');

const createExam = async (req, res) => {
  try {
    const { title, courseId, duration, startTime, endTime, questions, shuffleQuestions, shuffleOptions, instructions } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const exam = await Exam.create({
      title, course: courseId, instructor: req.user._id,
      semester: course.semester, program: course.program,
      duration, startTime, endTime, questions: questions || [],
      shuffleQuestions, shuffleOptions, instructions
    });
    res.status(201).json(exam);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getMyExams = async (req, res) => {
  try {
    const exams = await Exam.find({ instructor: req.user._id })
      .populate('course','courseCode courseName semester program')
      .sort({ createdAt: -1 });
    res.json(exams);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('course');
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (exam.instructor.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    res.json(exam);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (exam.instructor.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    const updated = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (exam.instructor.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });

    // ✅ FIX: Pehle saare related attempts delete karo (taake orphan data na rahe)
    await Attempt.deleteMany({ exam: req.params.id });

    // Phir exam delete karo
    await Exam.findByIdAndDelete(req.params.id);
    res.json({ message: 'Exam and related attempts deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Results — scores only, no answers
const getExamResults = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (exam.instructor.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    const attempts = await Attempt.find({ exam: req.params.id, status: { $in: ['submitted','graded'] } })
      .populate('student','name studentId email program semester')
      .select('student totalMarksObtained totalMarks percentage grade totalCheatingFlags submittedAt autoSubmitted status shortAnswerGraded');
    res.json(attempts);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Grade short answers — instructor reads and manually awards marks
const gradeShortAnswer = async (req, res) => {
  try {
    const { grades } = req.body; // [{ questionId, marksObtained }]
    const attempt = await Attempt.findById(req.params.attemptId).populate('exam');
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.exam.instructor.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });

    grades.forEach(g => {
      const ans = attempt.answers.find(a => a.questionId.toString() === g.questionId);
      if (ans && ans.questionType === 'short_answer') {
        ans.marksObtained = Math.min(Math.max(0, g.marksObtained), ans.marksTotal);
        ans.isCorrect = g.marksObtained > 0;
      }
    });

    attempt.totalMarksObtained = attempt.answers.reduce((s, a) => s + (a.marksObtained || 0), 0);
    attempt.percentage = attempt.totalMarks > 0 ? Math.round((attempt.totalMarksObtained / attempt.totalMarks) * 100) : 0;
    attempt.grade = attempt.calculateGrade();
    attempt.status = 'graded';
    attempt.shortAnswerGraded = true;
    await attempt.save();
    res.json({ message: 'Graded', percentage: attempt.percentage, grade: attempt.grade });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Get full paper for a student — instructor searches by student ID
const getStudentPaperByInstructor = async (req, res) => {
  try {
    const student = await User.findOne({ studentId: req.params.studentId }).select('-password');
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Only show attempts for THIS instructor's exams
    const myExamIds = (await Exam.find({ instructor: req.user._id })).map(e => e._id);
    const attempts = await Attempt.find({
      student: student._id,
      exam: { $in: myExamIds },
      status: { $in: ['submitted','graded'] }
    })
      .populate({ path: 'exam', populate: { path: 'course', select: 'courseCode courseName' } })
      .sort({ submittedAt: -1 });

    res.json({ student, attempts });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getExamAnalytics = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (exam.instructor.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    const attempts = await Attempt.find({ exam: req.params.id, status: { $in: ['submitted','graded'] } });
    if (!attempts.length) return res.json({ totalAttempts: 0 });
    const scores = attempts.map(a => a.percentage || 0);
    const gradeDistribution = {'A+':0,'A':0,'A-':0,'B+':0,'B':0,'B-':0,'C+':0,'C':0,'D':0,'F':0};
    attempts.forEach(a => { if (a.grade && gradeDistribution[a.grade] !== undefined) gradeDistribution[a.grade]++; });
    res.json({
      totalAttempts: attempts.length,
      avgScore: Math.round((scores.reduce((a,b)=>a+b,0)/scores.length)*10)/10,
      highestScore: Math.max(...scores), lowestScore: Math.min(...scores),
      passRate: Math.round((scores.filter(s=>s>=50).length/scores.length)*100),
      gradeDistribution,
      cheatingCases: attempts.filter(a=>a.totalCheatingFlags>0).length
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getMyCourses = async (req, res) => {
  try {
    const courses = await Course.find({ instructor: req.user._id }).sort({ courseCode: 1 });
    res.json(courses);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  createExam, getMyExams, getExamById, updateExam, deleteExam,
  getExamResults, gradeShortAnswer, getStudentPaperByInstructor,
  getExamAnalytics, getMyCourses
};
