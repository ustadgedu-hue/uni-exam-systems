const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:             { type: String, required: true, trim: true, maxlength: 100 },
  email:            { type: String, required: true, unique: true, lowercase: true, trim: true,
                      match: [/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/, 'Invalid email format'] },
  // ✅ Stronger password: minimum 8 chars (industry standard).
  // Bcrypt hash ~60 chars so minlength check applies to plaintext only.
  password:         { type: String, required: true, minlength: 8 },
  role:             { type: String, enum: ['admin', 'instructor', 'student'], required: true },
  studentId:        { type: String, unique: true, sparse: true, trim: true },
  department:       { type: String },
  semester:         { type: Number, min: 1, max: 8 },
  program:          { type: String },
  enrolledCourses:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  isActive:         { type: Boolean, default: true },
  createdAt:        { type: Date, default: Date.now }
});

// ✅ Indexes for faster queries (login, search, dashboard)
userSchema.index({ email: 1 });
userSchema.index({ studentId: 1 });
userSchema.index({ role: 1, program: 1, semester: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  // Skip min length check for already-hashed passwords (length will be 60)
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
