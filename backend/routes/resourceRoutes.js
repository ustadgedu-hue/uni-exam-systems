const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getUploadSignature,
  uploadResource,
  searchResources,
  downloadResource,
  getMyResources,
  deleteResource
} = require('../controllers/resourceController');

router.get('/search', protect, searchResources);
router.get('/my', protect, authorize('instructor', 'admin'), getMyResources);
router.get('/:id/download', protect, downloadResource);

// Upload ab 2 requests mein hota hai: pehle signature, phir metadata.
// File in dono ke darmiyan browser se seedha Cloudinary jati hai.
router.post('/signature', protect, authorize('instructor', 'admin'), getUploadSignature);
router.post('/upload', protect, authorize('instructor', 'admin'), uploadResource);

router.delete('/:id', protect, authorize('instructor', 'admin'), deleteResource);

module.exports = router;
