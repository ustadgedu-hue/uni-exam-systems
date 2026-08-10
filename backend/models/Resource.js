const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ['past_paper', 'course_material'], required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  // Cloudinary ka public_id. Download ka URL yahan save NAHI hota — wo har
  // request pe naya sign hota hai aur 5 minute mein expire ho jata hai.
  publicId: { type: String, required: true },
  fileType: { type: String },  // pdf, jpg, png
  fileSize: { type: Number },
  year: { type: Number },      // for past papers: which year
  semester: { type: String },  // for past papers: Spring/Fall
  isActive: { type: Boolean, default: true },
  downloadCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resource', resourceSchema);
