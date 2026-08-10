const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getAvailableExams, startExam, saveAnswer, skipQuestion, logCheatingFlag, submitExam } = require('../controllers/examController');

router.use(protect, authorize('student'));
router.get('/available', getAvailableExams);
router.post('/:id/start', startExam);
router.post('/attempt/:attemptId/answer', saveAnswer);
router.post('/attempt/:attemptId/skip', skipQuestion);
router.post('/attempt/:attemptId/flag', logCheatingFlag);
router.post('/attempt/:attemptId/submit', submitExam);

module.exports = router;
