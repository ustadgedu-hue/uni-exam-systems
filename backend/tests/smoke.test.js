// ═══════════════════════════════════════════════════════════════════════════
// SMOKE TESTS - Sab se zaroori API behaviour ki jaanch
// ═══════════════════════════════════════════════════════════════════════════
//
// Chalane ka tareeqa:  npm test
//
// Ye Node ka built-in test runner (node:test) use karta hai — koi Jest ya
// Mocha install karne ki zaroorat nahi.
//
// Database asli nahi hota: mongodb-memory-server RAM mein ek asthai MongoDB
// chalata hai. Isliye ye tests internet, Atlas ya Cloudinary ke bagair chalte
// hain aur aap ka asli data kabhi nahi chhoote.
//
// Ye kya cover karta hai: auth, authorization boundaries, aur naya Cloudinary
// upload verification. Ye poora exam-taking flow cover NAHI karta — wo aage
// ka kaam hai.
// ═══════════════════════════════════════════════════════════════════════════

const test = require('node:test');
const assert = require('node:assert');

// app.js config guard chalata hai, isliye ye require() se PEHLE set karna zaroori hai
process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-for-the-guard';
process.env.JWT_EXPIRE = '1h';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const { cloudinary, DELIVERY_TYPE } = require('../config/cloudinary');

let mongod;
let studentToken;
let instructorToken;
let courseId;

const STUDENT = { email: 'student@test.edu', password: 'student12345' };
const INSTRUCTOR = { email: 'instructor@test.edu', password: 'instructor12345' };

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await User.create({
    name: 'Test Student', email: STUDENT.email, password: STUDENT.password,
    role: 'student', studentId: 'BSCS-001', semester: 5, program: 'BSCS'
  });
  await User.create({
    name: 'Test Instructor', email: INSTRUCTOR.email, password: INSTRUCTOR.password,
    role: 'instructor', department: 'Computer Science'
  });

  const course = await Course.create({
    courseCode: 'CS301', courseName: 'Data Structures',
    semester: 3, program: 'BSCS', department: 'Computer Science', creditHours: 3
  });
  courseId = course._id.toString();

  const s = await request(app).post('/api/auth/login').send(STUDENT);
  studentToken = s.body.token;

  const i = await request(app).post('/api/auth/login').send(INSTRUCTOR);
  instructorToken = i.body.token;
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// ─── Health ────────────────────────────────────────────────────────────────
test('GET /api/health returns 200', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.match(res.body.status, /running/);
});

test('unknown /api route returns JSON 404, not HTML', async () => {
  const res = await request(app).get('/api/does-not-exist');
  assert.strictEqual(res.status, 404);
  assert.ok(res.body.message.includes('Route not found'));
});

// ─── Auth ──────────────────────────────────────────────────────────────────
test('login with correct credentials returns a token', async () => {
  const res = await request(app).post('/api/auth/login').send(STUDENT);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token, 'expected a JWT in the response');
  assert.strictEqual(res.body.role, 'student');
  assert.strictEqual(res.body.password, undefined, 'password must never be returned');
});

test('login with wrong password returns 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: STUDENT.email, password: 'wrong-password' });
  assert.strictEqual(res.status, 401);
  assert.ok(!res.body.token);
});

test('login with unknown email returns 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'nobody@test.edu', password: 'whatever12345' });
  assert.strictEqual(res.status, 401);
});

// ─── Authentication boundary ───────────────────────────────────────────────
test('resource search without a token returns 401', async () => {
  const res = await request(app).get('/api/resources/search');
  assert.strictEqual(res.status, 401);
});

test('resource search with a valid token returns 200', async () => {
  const res = await request(app)
    .get('/api/resources/search')
    .set('Authorization', `Bearer ${studentToken}`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
});

test('a garbage token is rejected with 401', async () => {
  const res = await request(app)
    .get('/api/resources/search')
    .set('Authorization', 'Bearer not-a-real-jwt');
  assert.strictEqual(res.status, 401);
});

// ─── Authorization boundary (new in the Cloudinary migration) ──────────────
test('a student cannot request an upload signature (403)', async () => {
  const res = await request(app)
    .post('/api/resources/signature')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ fileName: 'paper.pdf' });
  assert.strictEqual(res.status, 403);
});

test('an instructor CAN request an upload signature', async () => {
  const res = await request(app)
    .post('/api/resources/signature')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({ fileName: 'paper.pdf' });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.signature);
  assert.ok(res.body.publicId);
  assert.strictEqual(res.body.cloudName, 'test-cloud');
  assert.strictEqual(res.body.resourceType, 'raw');
  assert.strictEqual(res.body.deliveryType, 'private');
});

test('signature request rejects a disallowed file type', async () => {
  const res = await request(app)
    .post('/api/resources/signature')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({ fileName: 'malware.exe' });
  assert.strictEqual(res.status, 400);
});

// ─── The verify-then-create check ──────────────────────────────────────────
test('upload is rejected when Cloudinary does not know the publicId', async (t) => {
  // Cloudinary ko stub karo taake wo "file nahi mili" kahe
  t.mock.method(cloudinary.api, 'resource', async () => {
    throw new Error('Resource not found');
  });

  const res = await request(app)
    .post('/api/resources/upload')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({
      title: 'Fake paper', type: 'past_paper', courseId,
      publicId: 'attacker-supplied-id', fileName: 'evil.pdf'
    });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /could not be verified/i);
});

test('upload stores what Cloudinary reports, not what the client sent', async (t) => {
  const mockResource = t.mock.method(cloudinary.api, 'resource', async () => ({
    public_id: 'exam_system/resources/real-id',
    bytes: 1024
  }));

  const res = await request(app)
    .post('/api/resources/upload')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({
      title: 'CS301 Final 2023', type: 'past_paper', courseId,
      publicId: 'real-id', fileName: 'cs301-final.pdf',
      year: '2023', semester: 'Fall',
      // Client apna URL bhejne ki koshish kar raha hai — ignore hona chahiye
      fileUrl: 'https://evil.example.com/malware.pdf',
      downloadCount: 9999
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.publicId, 'exam_system/resources/real-id');
  assert.strictEqual(res.body.fileType, 'pdf');
  assert.strictEqual(res.body.fileSize, 1024);
  assert.strictEqual(res.body.downloadCount, 0, 'client-supplied downloadCount must be ignored');
  assert.strictEqual(res.body.fileUrl, undefined, 'no permanent URL is stored');

  // Asset 'private' type ke tor pe verify hona chahiye
  assert.strictEqual(mockResource.mock.calls[0].arguments[1].type, DELIVERY_TYPE);
});

// Cloudinary 'raw' uploads ka public_id extension ke saath wapas aata hai.
// Ye test us asli behaviour ko pakadta hai (mock ne pehle isay chhupa liya tha).
test('upload accepts the extension Cloudinary appends to the public_id', async (t) => {
  const storedId = 'exam_system/resources/signed-id.pdf';

  const mockResource = t.mock.method(cloudinary.api, 'resource', async () => ({
    public_id: storedId, bytes: 2048
  }));

  const res = await request(app)
    .post('/api/resources/upload')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({
      title: 'With extension', type: 'past_paper', courseId,
      publicId: 'signed-id',
      cloudinaryPublicId: storedId,
      fileName: 'paper.pdf'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.publicId, storedId);
  // Backend ne Cloudinary se WAHI id poochi jo store hui thi
  assert.strictEqual(mockResource.mock.calls[0].arguments[0], storedId);
});

// ─── Download: signed, expiring link ───────────────────────────────────────
test('download returns a signed expiring URL and increments the counter', async (t) => {
  t.mock.method(cloudinary.api, 'resource', async () => ({
    public_id: 'exam_system/resources/dl-test.pdf', bytes: 512
  }));

  const created = await request(app)
    .post('/api/resources/upload')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({
      title: 'Downloadable', type: 'past_paper', courseId,
      publicId: 'dl-test', cloudinaryPublicId: 'exam_system/resources/dl-test.pdf',
      fileName: 'dl.pdf'
    });
  assert.strictEqual(created.status, 201);

  // Students ko bhi download milna chahiye
  const res = await request(app)
    .get(`/api/resources/${created.body._id}/download`)
    .set('Authorization', `Bearer ${studentToken}`);

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.url.includes('/raw/download'), 'must use the authenticated download endpoint');
  assert.match(res.body.url, /type=private/, 'must request the private asset');
  assert.match(res.body.url, /signature=/, 'URL must be signed');
  assert.match(res.body.url, /expires_at=/, 'URL must expire');
  assert.match(res.body.url, /attachment=true/, 'must download rather than open inline');
  assert.strictEqual(res.body.fileName, 'dl.pdf');

  // Counter barha?
  const search = await request(app)
    .get('/api/resources/search?type=past_paper')
    .set('Authorization', `Bearer ${studentToken}`);
  const found = search.body.find(r => r._id === created.body._id);
  assert.strictEqual(found.downloadCount, 1);
});

test('download of a non-existent resource returns 404', async () => {
  const res = await request(app)
    .get('/api/resources/000000000000000000000000/download')
    .set('Authorization', `Bearer ${studentToken}`);
  assert.strictEqual(res.status, 404);
});

test('upload rejects a publicId pointing at someone else\'s file', async (t) => {
  t.mock.method(cloudinary.api, 'resource', async () => {
    assert.fail('Cloudinary should never be queried for a mismatched id');
  });

  const res = await request(app)
    .post('/api/resources/upload')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({
      title: 'Hijack', type: 'past_paper', courseId,
      publicId: 'my-signed-id',
      cloudinaryPublicId: 'exam_system/resources/someone-elses-file.pdf',
      fileName: 'paper.pdf'
    });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /does not match the signed upload/i);
});

test('upload rejects a path-traversal attempt after the signed prefix', async (t) => {
  t.mock.method(cloudinary.api, 'resource', async () => {
    assert.fail('Cloudinary should never be queried for a traversal id');
  });

  const res = await request(app)
    .post('/api/resources/upload')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({
      title: 'Traversal', type: 'past_paper', courseId,
      publicId: 'signed-id',
      cloudinaryPublicId: 'exam_system/resources/signed-id.pdf/../../private/secret',
      fileName: 'paper.pdf'
    });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /does not match the signed upload/i);
});

test('upload rejects a file over the 20MB limit', async (t) => {
  t.mock.method(cloudinary.api, 'resource', async () => ({
    public_id: 'exam_system/resources/too-big',
    secure_url: 'https://res.cloudinary.com/test-cloud/raw/upload/too-big',
    bytes: 21 * 1024 * 1024
  }));
  t.mock.method(cloudinary.uploader, 'destroy', async () => ({ result: 'ok' }));

  const res = await request(app)
    .post('/api/resources/upload')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({
      title: 'Huge', type: 'past_paper', courseId,
      publicId: 'too-big', fileName: 'huge.pdf'
    });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /20MB/);
});

// ─── Search hardening ──────────────────────────────────────────────────────
test('a regex special character in the search query does not crash the API', async () => {
  const res = await request(app)
    .get('/api/resources/search?query=' + encodeURIComponent('CS301('))
    .set('Authorization', `Bearer ${studentToken}`);
  assert.strictEqual(res.status, 200);
});
