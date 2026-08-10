const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: { type: String, enum: ['mcq', 'short_answer'], required: true },
  options: [{ type: String }],           // for MCQ only
  correctAnswer: { type: String },       // for MCQ: option index as string; for short_answer: model answer
  marks: { type: Number, default: 1 },
  order: { type: Number }
});

const examSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  course:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  instructor:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  // ✅ FIX #2: semester and program now OPTIONAL (matches Course model)
  // They are auto-populated from the course in the controller, but if missing it's not a crash.
  semester:    { type: Number },
  program:     { type: String },
  questions:   [questionSchema],
  totalMarks:  { type: Number, default: 0 },
  duration:    { type: Number, required: true }, // in minutes
  startTime:   { type: Date,   required: true },
  endTime:     { type: Date,   required: true },
  shuffleQuestions: { type: Boolean, default: true },
  shuffleOptions:   { type: Boolean, default: true },
  isActive:    { type: Boolean, default: true },
  instructions:{ type: String },
  createdAt:   { type: Date,   default: Date.now }
});

// Auto-calculate total marks
examSchema.pre('save', function(next) {
  this.totalMarks = this.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
  next();
});

module.exports = mongoose.model('Exam', examSchema);
