const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getMyResults, getMyPaper, getProfile } = require('../controllers/studentController');

router.use(protect, authorize('student'));
router.get('/profile', getProfile);
router.get('/results', getMyResults);
router.get('/results/:attemptId', getMyPaper);

module.exports = router;
