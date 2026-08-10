const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./config/db');
const User = require('./models/User');
const Course = require('./models/Course');

const seed = async () => {
  await connectDB();
  console.log('MongoDB connected...');

  await User.deleteMany({});
  await Course.deleteMany({});
  console.log('Old data cleared...');

  // ══════════════════════════════════════════
  // ALL BSCS COURSES - University of Education Lahore
  // ══════════════════════════════════════════
  const coursesData = [
    // ── SEMESTER 1 ──
    { courseCode: 'ENGL1114', courseName: 'Functional English',                         semester: 1, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP1114', courseName: 'Introduction to Information & Communication Technologies', semester: 1, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'PAKS1111', courseName: 'Pakistan Studies',                            semester: 1, program: 'BSCS', department: 'Computer Science', creditHours: 2 },
    { courseCode: 'MATH1111', courseName: 'Calculus - I',                                semester: 1, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'PHYS1116', courseName: 'Applied Physics',                             semester: 1, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'UNIV1101', courseName: 'University Elective - I',                     semester: 1, program: 'BSCS', department: 'Computer Science', creditHours: 3 },

    // ── SEMESTER 2 ──
    { courseCode: 'PHYS4129', courseName: 'Digital Logic Design',                        semester: 2, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'COMP1112', courseName: 'Programming Fundamentals',                    semester: 2, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'MATH2113', courseName: 'Discrete Mathematics',                        semester: 2, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'ENGL1119', courseName: 'Communication Skills',                        semester: 2, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'ISLA1111', courseName: 'Islamic Studies / Ethics',                    semester: 2, program: 'BSCS', department: 'Computer Science', creditHours: 2 },
    { courseCode: 'STAT2111', courseName: 'Introduction to Statistics and Probability',  semester: 2, program: 'BSCS', department: 'Computer Science', creditHours: 3 },

    // ── SEMESTER 3 ──
    { courseCode: 'COMP2111', courseName: 'Object Oriented Programming',                 semester: 3, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'COMP2112', courseName: 'Software Engineering',                        semester: 3, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP3112', courseName: 'Computer Communications and Networks',        semester: 3, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'MATH2114', courseName: 'Elementary Linear Algebra',                   semester: 3, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'UNIV1102', courseName: 'University Elective - II',                    semester: 3, program: 'BSCS', department: 'Computer Science', creditHours: 3 },

    // ── SEMESTER 4 ──
    { courseCode: 'COMP2113', courseName: 'Data Structures and Algorithms',              semester: 4, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'COMP2115', courseName: 'Operating Systems',                           semester: 4, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'COMP2114', courseName: 'Database Systems',                            semester: 4, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'UNIV1103', courseName: 'University Elective - III',                   semester: 4, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'UNIV1104', courseName: 'University Elective - IV',                    semester: 4, program: 'BSCS', department: 'Computer Science', creditHours: 3 },

    // ── SEMESTER 5 ──
    { courseCode: 'COMP3137', courseName: 'Computer Organization and Assembly Language', semester: 5, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'COMP3138', courseName: 'Design and Analysis of Algorithms',           semester: 5, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP3139', courseName: 'Parallel & Distributed Computing',            semester: 5, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'ENGL2115', courseName: 'Technical Writing and Presentation Skills',   semester: 5, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP3E01', courseName: 'CS Elective - I',                             semester: 5, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'MATH3122', courseName: 'Multivariable Calculus',                      semester: 5, program: 'BSCS', department: 'Computer Science', creditHours: 3 },

    // ── SEMESTER 6 ──
    { courseCode: 'COMP3140', courseName: 'Theory of Automata and Formal Languages',     semester: 6, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'MATH3123', courseName: 'Differential Equations',                      semester: 6, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP3141', courseName: 'Information Security',                        semester: 6, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP3E02', courseName: 'CS Elective - II',                            semester: 6, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP3E03', courseName: 'CS Elective - III',                           semester: 6, program: 'BSCS', department: 'Computer Science', creditHours: 3 },

    // ── SEMESTER 7 ──
    { courseCode: 'COMP4113', courseName: 'Compiler Construction',                       semester: 7, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP4114', courseName: 'Artificial Intelligence',                     semester: 7, program: 'BSCS', department: 'Computer Science', creditHours: 4 },
    { courseCode: 'COMP4E01', courseName: 'CS Elective - IV',                            semester: 7, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP4115', courseName: 'Final Year Project - I',                      semester: 7, program: 'BSCS', department: 'Computer Science', creditHours: 3 },

    // ── SEMESTER 8 ──
    { courseCode: 'MATH4137', courseName: 'Numerical Computing',                         semester: 8, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP4117', courseName: 'Professional Practices',                      semester: 8, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP4E02', courseName: 'CS Elective - V',                             semester: 8, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
    { courseCode: 'COMP4116', courseName: 'Final Year Project - II',                     semester: 8, program: 'BSCS', department: 'Computer Science', creditHours: 3 },
  ];

  // ══════════════════════════════════════════
  // CREATE ADMIN
  // ══════════════════════════════════════════
  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@exam.com',
    password: 'admin123',
    role: 'admin'
  });
  console.log('✅ Admin created');

  // ══════════════════════════════════════════
  // CREATE INSTRUCTORS (one per subject group)
  // ══════════════════════════════════════════
  const instructor1 = await User.create({
    name: 'Dr. Ali Hassan',
    email: 'ali.instructor@exam.com',
    password: 'instructor123',
    role: 'instructor',
    department: 'Computer Science'
  });

  const instructor2 = await User.create({
    name: 'Dr. Sara Ahmed',
    email: 'sara.instructor@exam.com',
    password: 'instructor123',
    role: 'instructor',
    department: 'Computer Science'
  });
  console.log('✅ Instructors created');

  // ══════════════════════════════════════════
  // CREATE ALL COURSES — assign instructors
  // ══════════════════════════════════════════
  const createdCourses = [];
  for (let i = 0; i < coursesData.length; i++) {
    const c = coursesData[i];
    // Alternate instructors
    const instr = i % 2 === 0 ? instructor1._id : instructor2._id;
    const course = await Course.create({ ...c, instructor: instr });
    createdCourses.push(course);
  }
  console.log(`✅ ${createdCourses.length} courses created`);

  // Helper: get course IDs by semester
  const getCoursesBySemester = (sem) =>
    createdCourses.filter(c => c.semester === sem).map(c => c._id);

  // ══════════════════════════════════════════
  // CREATE EXAMPLE STUDENTS (one per semester)
  // ══════════════════════════════════════════
  const students = [
    { name: 'Ahmed Raza',    email: 'ahmed.student@exam.com',  studentId: 'BSCS-2024-001', semester: 1 },
    { name: 'Fatima Malik',  email: 'fatima.student@exam.com', studentId: 'BSCS-2023-002', semester: 2 },
    { name: 'Usman Ali',     email: 'usman.student@exam.com',  studentId: 'BSCS-2023-003', semester: 3 },
    { name: 'Ayesha Khan',   email: 'ayesha.student@exam.com', studentId: 'BSCS-2022-004', semester: 4 },
    { name: 'Hassan Tariq',  email: 'hassan.student@exam.com', studentId: 'BSCS-2022-005', semester: 5 },
    { name: 'Zainab Noor',   email: 'zainab.student@exam.com', studentId: 'BSCS-2021-006', semester: 6 },
    { name: 'Bilal Cheema',  email: 'bilal.student@exam.com',  studentId: 'BSCS-2021-007', semester: 7 },
    { name: 'Maher Hamza',   email: 'maher.student@exam.com',  studentId: 'BSCS-2021-008', semester: 8 },
  ];

  for (const s of students) {
    await User.create({
      name: s.name,
      email: s.email,
      password: 'student123',
      role: 'student',
      studentId: s.studentId,
      department: 'Computer Science',
      semester: s.semester,
      program: 'BSCS',
      enrolledCourses: getCoursesBySemester(s.semester)
    });
  }
  console.log(`✅ ${students.length} students created (one per semester)`);

  // ══════════════════════════════════════════
  // FINAL SUMMARY
  // ══════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║           DATABASE SEEDED SUCCESSFULLY!              ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  ADMIN                                               ║');
  console.log('║  Email   : admin@exam.com                            ║');
  console.log('║  Password: admin123                                  ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  INSTRUCTORS (password: instructor123)               ║');
  console.log('║  ali.instructor@exam.com                             ║');
  console.log('║  sara.instructor@exam.com                            ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  STUDENTS (password: student123)                     ║');
  console.log('║  ahmed.student@exam.com   → Sem 1                   ║');
  console.log('║  fatima.student@exam.com  → Sem 2                   ║');
  console.log('║  usman.student@exam.com   → Sem 3                   ║');
  console.log('║  ayesha.student@exam.com  → Sem 4                   ║');
  console.log('║  hassan.student@exam.com  → Sem 5                   ║');
  console.log('║  zainab.student@exam.com  → Sem 6                   ║');
  console.log('║  bilal.student@exam.com   → Sem 7                   ║');
  console.log('║  maher.student@exam.com   → Sem 8 (FYP)             ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  COURSES : ${createdCourses.length} total (Sem 1-8, all from UE Lahore)   ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  mongoose.disconnect();
};

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
