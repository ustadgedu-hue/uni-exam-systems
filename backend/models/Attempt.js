const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId:    { type: mongoose.Schema.Types.ObjectId },
  questionText:  { type: String },
  questionType:  { type: String },
  selectedOption:{ type: String },
  writtenAnswer: { type: String },
  isCorrect:     { type: Boolean, default: false },
  marksObtained: { type: Number, default: 0 },
  marksTotal:    { type: Number, default: 1 },
  skipped:       { type: Boolean, default: false }
});

const cheatingFlagSchema = new mongoose.Schema({
  type:      { type: String, enum: ['tab_switch','copy_paste','right_click','window_blur','keyboard_shortcut'] },
  timestamp: { type: Date, default: Date.now },
  detail:    { type: String }
});

const attemptSchema = new mongoose.Schema({
  exam:              { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  student:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers:           [answerSchema],
  questionOrder:     [{ type: mongoose.Schema.Types.ObjectId }],
  startedAt:         { type: Date, default: Date.now },
  submittedAt:       { type: Date },
  autoSubmitted:     { type: Boolean, default: false },
  status:            { type: String, enum: ['in_progress','submitted','graded'], default: 'in_progress' },
  totalMarksObtained:{ type: Number, default: 0 },
  totalMarks:        { type: Number, default: 0 },
  percentage:        { type: Number, default: 0 },
  grade:             { type: String },
  cheatingFlags:     [cheatingFlagSchema],
  totalCheatingFlags:{ type: Number, default: 0 },
  ipAddress:         { type: String },
  shortAnswerGraded: { type: Boolean, default: false }
});

// FIX: Removed unique constraint - was causing auto-submit error
// startExam handles duplicates properly by returning existing in_progress attempt
attemptSchema.index({ exam: 1, student: 1 });
attemptSchema.index({ student: 1, status: 1 });
attemptSchema.index({ exam: 1, status: 1 });
attemptSchema.index({ totalCheatingFlags: -1 });

attemptSchema.methods.calculateGrade = function() {
  const p = this.percentage;
  if (p >= 90) return 'A+'; if (p >= 85) return 'A'; if (p >= 80) return 'A-';
  if (p >= 75) return 'B+'; if (p >= 70) return 'B'; if (p >= 65) return 'B-';
  if (p >= 60) return 'C+'; if (p >= 55) return 'C'; if (p >= 50) return 'D';
  return 'F';
};

module.exports = mongoose.model('Attempt', attemptSchema);
