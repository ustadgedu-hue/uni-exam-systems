const Exam = require('../models/Exam');
const Attempt = require('../models/Attempt');
const User = require('../models/User');

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Get available exams — show 5 minutes BEFORE start time
const getAvailableExams = async (req, res) => {
  try {
    const student = await User.findById(req.user._id).populate('enrolledCourses');
    const now = new Date();
    const enrolledCourseIds = student.enrolledCourses.map(c => c._id.toString());
    if (!enrolledCourseIds.length) return res.json([]);

    // FIX: 5 min preview (was 4)
    const fiveMinsFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    const examFilter = {
      course: { $in: enrolledCourseIds },
      startTime: { $lte: fiveMinsFromNow },
      endTime: { $gte: now },
      isActive: true,
    };
    if (student.semester) examFilter.semester = student.semester;
    if (student.program) examFilter.program = student.program;

    const exams = await Exam.find(examFilter)
      .populate('course', 'courseCode courseName')
      .select('-questions');

    // FIX: Get attempts with status to distinguish in_progress from submitted
    const attempts = await Attempt.find({
      student: req.user._id,
      exam: { $in: exams.map(e => e._id) }
    }).select('exam status');

    // Map exam ID -> attempt status
    const attemptMap = {};
    attempts.forEach(a => { attemptMap[a.exam.toString()] = a.status; });

    const result = exams.map(e => {
      const started = new Date(e.startTime) <= now;
      const status = attemptMap[e._id.toString()];
      // Only show as "attempted" if actually submitted or graded
      const isSubmitted = status === 'submitted' || status === 'graded';
      const isInProgress = status === 'in_progress';
      return {
        ...e.toObject(),
        attempted: isSubmitted,
        inProgress: isInProgress,
        canStart: started
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Start exam — handles existing attempts gracefully
const startExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    const now = new Date();
    if (now < exam.startTime) {
      const mins = Math.ceil((exam.startTime - now) / 60000);
      return res.status(400).json({ message: `Exam starts in ${mins} minute(s). Please wait.` });
    }
    if (now > exam.endTime) return res.status(400).json({ message: 'Exam time has ended.' });

    const student = await User.findById(req.user._id);
    const enrolled = student.enrolledCourses.map(c => c.toString()).includes(exam.course.toString());
    if (!enrolled) return res.status(403).json({ message: 'You are not enrolled in this course.' });

    if (student.semester && exam.semester && student.semester !== exam.semester) {
      return res.status(403).json({ message: 'This exam is for a different semester.' });
    }
    if (student.program && exam.program && student.program !== exam.program) {
      return res.status(403).json({ message: 'This exam is for a different program.' });
    }

    // FIX: Robust existing attempt handling — no more duplicate key errors
    let attempt = await Attempt.findOne({ student: req.user._id, exam: exam._id });

    if (attempt) {
      if (attempt.status === 'submitted' || attempt.status === 'graded') {
        return res.status(400).json({ message: 'You have already submitted this exam.' });
      }
      // Resume in_progress attempt
      return res.json({
        attempt,
        exam: buildSafeExam(exam, attempt.questionOrder),
        resumed: true
      });
    }

    // No existing attempt — create new one
    let questionOrder = exam.questions.map(q => q._id);
    if (exam.shuffleQuestions) questionOrder = shuffleArray(questionOrder);

    try {
      attempt = await Attempt.create({
        exam: exam._id,
        student: req.user._id,
        questionOrder,
        answers: [],
        totalMarks: exam.totalMarks,
        ipAddress: req.ip
      });
    } catch (createErr) {
      // FIX: If duplicate key error (race condition), fetch the existing one
      if (createErr.code === 11000) {
        attempt = await Attempt.findOne({ student: req.user._id, exam: exam._id });
        if (attempt && attempt.status === 'in_progress') {
          return res.json({
            attempt,
            exam: buildSafeExam(exam, attempt.questionOrder),
            resumed: true
          });
        }
        return res.status(400).json({ message: 'Could not start exam. Please refresh and try again.' });
      }
      throw createErr;
    }

    res.json({ attempt, exam: buildSafeExam(exam, questionOrder) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function buildSafeExam(exam, questionOrder) {
  const ordered = questionOrder.map(qId => {
    const q = exam.questions.find(q => q._id.toString() === qId.toString());
    if (!q) return null;
    const safe = { _id: q._id, questionText: q.questionText, questionType: q.questionType, marks: q.marks };
    if (q.questionType === 'mcq') {
      safe.options = exam.shuffleOptions ? shuffleArray([...q.options]) : [...q.options];
    }
    return safe;
  }).filter(Boolean);
  return {
    _id: exam._id, title: exam.title, duration: exam.duration,
    totalMarks: exam.totalMarks, instructions: exam.instructions,
    endTime: exam.endTime, startTime: exam.startTime, questions: ordered
  };
}

const saveAnswer = async (req, res) => {
  try {
    const { questionId, selectedOption, writtenAnswer } = req.body;
    const attempt = await Attempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.student.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ message: 'Exam already submitted' });

    const exam = await Exam.findById(attempt.exam);
    const question = exam.questions.find(q => q._id.toString() === questionId);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const existing = attempt.answers.find(a => a.questionId.toString() === questionId);
    if (existing && question.questionType === 'mcq') {
      return res.status(400).json({ message: 'MCQ answer already locked.' });
    }

    if (existing) {
      existing.writtenAnswer = writtenAnswer;
    } else {
      attempt.answers.push({
        questionId: question._id,
        questionText: question.questionText,
        questionType: question.questionType,
        selectedOption,
        writtenAnswer,
        isCorrect: false,
        marksObtained: 0,
        marksTotal: question.marks
      });
    }
    await attempt.save();
    res.json({ message: 'Answer saved', locked: question.questionType === 'mcq' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const skipQuestion = async (req, res) => {
  try {
    const { questionId } = req.body;
    const attempt = await Attempt.findById(req.params.attemptId);
    if (!attempt || attempt.student.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ message: 'Already submitted' });

    const existing = attempt.answers.find(a => a.questionId.toString() === questionId);
    if (!existing) {
      const exam = await Exam.findById(attempt.exam);
      const q = exam.questions.find(q => q._id.toString() === questionId);
      if (q) {
        attempt.answers.push({
          questionId: q._id, questionText: q.questionText,
          questionType: q.questionType, selectedOption: null,
          writtenAnswer: '(Skipped due to cheating warning)',
          isCorrect: false, marksObtained: 0, marksTotal: q.marks, skipped: true
        });
      }
    } else {
      // FIX: If answer exists, mark it as skipped only if explicitly triggered
      existing.skipped = true;
    }
    await attempt.save();
    res.json({ message: 'Question skipped' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const logCheatingFlag = async (req, res) => {
  try {
    const { type, detail } = req.body;
    const attempt = await Attempt.findById(req.params.attemptId);
    if (!attempt || attempt.status !== 'in_progress') return res.status(400).json({ message: 'Invalid attempt' });
    if (attempt.student.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    attempt.cheatingFlags.push({ type, detail, timestamp: new Date() });
    attempt.totalCheatingFlags = attempt.cheatingFlags.length;
    await attempt.save();
    res.json({ flagged: true, totalFlags: attempt.totalCheatingFlags });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const submitExam = async (req, res) => {
  try {
    const { autoSubmit } = req.body;
    const attempt = await Attempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.student.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ message: 'Already submitted' });

    const exam = await Exam.findById(attempt.exam);

    let mcqMarks = 0, hasShortAnswer = false;
    attempt.answers.forEach(ans => {
      if (ans.skipped) return;

      if (ans.questionType === 'mcq') {
        const q = exam.questions.find(qq => qq._id.toString() === ans.questionId.toString());
        if (q && ans.selectedOption !== null && ans.selectedOption !== undefined) {
          const isCorrect = String(ans.selectedOption) === String(q.correctAnswer);
          ans.isCorrect = isCorrect;
          ans.marksObtained = isCorrect ? q.marks : 0;
          mcqMarks += ans.marksObtained;
        }
      }
      if (ans.questionType === 'short_answer') {
        hasShortAnswer = true;
      }
    });

    attempt.totalMarksObtained = mcqMarks;
    attempt.totalMarks = exam.totalMarks;
    attempt.percentage = exam.totalMarks > 0 ? Math.round((mcqMarks / exam.totalMarks) * 100) : 0;
    attempt.grade = attempt.calculateGrade();
    attempt.status = hasShortAnswer ? 'submitted' : 'graded';
    attempt.submittedAt = new Date();
    attempt.autoSubmitted = autoSubmit || false;
    attempt.shortAnswerGraded = !hasShortAnswer;
    await attempt.save();

    res.json({
      message: 'Exam submitted successfully',
      totalMarksObtained: attempt.totalMarksObtained,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      grade: attempt.grade,
      status: attempt.status
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getAvailableExams, startExam, saveAnswer, skipQuestion, logCheatingFlag, submitExam };
