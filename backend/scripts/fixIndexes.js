// ═══════════════════════════════════════════════════════════════════════════
// FIXINDEXES.JS - One-time database maintenance script
// ═══════════════════════════════════════════════════════════════════════════
//
// Chalane ka tareeqa:  npm run fix-indexes
//
// Ye code pehle server.js mein tha aur har startup pe chalta tha. Vercel par
// wo bahut mehnga hota — har cold start pe poori attempts collection load
// hoti. Isliye ab ye alag script hai jo aap khud chalate hain: ek dafa deploy
// ke baad, ya jab index ki koi ghalti aaye.
//
// Ye kya karta hai:
//   1. Users ka purana studentId index (jo sparse nahi tha) hata kar sahi banata hai
//   2. Attempts ka purana unique index hata deta hai (student dobara attempt de sake)
//   3. Orphan attempts saaf karta hai (jinka exam ya student delete ho chuka hai)
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Attempt = require('../models/Attempt');

async function fixIndexes() {
  await connectDB();
  console.log('✅ MongoDB connected');

  const db = mongoose.connection.db;

  // ── 1. Users: studentId ko sparse unique banao ──────────────────────────
  // Sparse zaroori hai kyunki instructors/admins ke paas studentId nahi hota.
  // Bagair sparse ke, ek se zyada null values "duplicate" mani jati hain.
  try {
    const userIndexes = await db.collection('users').indexes();
    const oldStudentIdIdx = userIndexes.find(i => i.name === 'studentId_1' && !i.sparse);
    if (oldStudentIdIdx) {
      await db.collection('users').dropIndex('studentId_1');
      console.log('✅ Removed old non-sparse studentId index');
    }
  } catch (err) {
    console.log('ℹ️  studentId index check skipped:', err.message);
  }

  try {
    await db.collection('users').createIndex(
      { studentId: 1 },
      { unique: true, sparse: true, name: 'studentId_sparse' }
    );
    console.log('✅ studentId sparse index ready');
  } catch (err) {
    console.log('ℹ️  studentId sparse index already exists');
  }

  // ── 2. Attempts: purana unique index hatao ──────────────────────────────
  try {
    const attemptIndexes = await db.collection('attempts').indexes();
    const oldUniqueIdx = attemptIndexes.find(i => i.name === 'exam_1_student_1' && i.unique);
    if (oldUniqueIdx) {
      await db.collection('attempts').dropIndex('exam_1_student_1');
      console.log('✅ Removed old unique attempts index');
    } else {
      console.log('ℹ️  No old unique attempts index found');
    }
  } catch (err) {
    console.log('ℹ️  Attempts index check skipped:', err.message);
  }

  // ── 3. Orphan attempts saaf karo ────────────────────────────────────────
  const allAttempts = await Attempt.find().populate('exam').populate('student');
  const orphanIds = allAttempts.filter(a => !a.exam || !a.student).map(a => a._id);

  if (orphanIds.length > 0) {
    await Attempt.deleteMany({ _id: { $in: orphanIds } });
    console.log(`✅ Cleaned ${orphanIds.length} orphan attempt(s)`);
  } else {
    console.log('ℹ️  No orphan attempts found');
  }

  console.log('\n🎉 Index maintenance complete.');
}

fixIndexes()
  .then(() => mongoose.connection.close())
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Index maintenance failed:', err.message);
    process.exit(1);
  });
