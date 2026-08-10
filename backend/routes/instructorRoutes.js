const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createExam, getMyExams, getExamById, updateExam, deleteExam,
  getExamResults, gradeShortAnswer, getStudentPaperByInstructor,
  getExamAnalytics, getMyCourses
} = require('../controllers/instructorController');

router.use(protect, authorize('instructor'));
router.get('/courses', getMyCourses);
router.get('/exams', getMyExams);
router.post('/exams', createExam);
router.get('/exams/:id', getExamById);
router.put('/exams/:id', updateExam);
router.delete('/exams/:id', deleteExam);
router.get('/exams/:id/results', getExamResults);
router.get('/exams/:id/analytics', getExamAnalytics);
router.put('/attempts/:attemptId/grade', gradeShortAnswer);
router.get('/student-paper/:studentId', getStudentPaperByInstructor);

module.exports = router;
