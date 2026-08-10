const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseCode:   { type: String, required: true, unique: true, uppercase: true },
  courseName:   { type: String, required: true },
  department:   { type: String },
  // semester and program are OPTIONAL - just for reference, not for filtering
  semester:     { type: Number },
  program:      { type: String },
  instructor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  creditHours:  { type: Number, default: 3 },
  isActive:     { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Course', courseSchema);
