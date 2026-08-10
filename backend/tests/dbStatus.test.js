// ═══════════════════════════════════════════════════════════════════════════
// DBSTATUS TESTS - Error classification ki jaanch
// ═══════════════════════════════════════════════════════════════════════════
//
// Ye woh hissa hai jo 10 second ki khamoshi ko ek kaam ki baat mein badalta
// hai. Sab se ahem test aakhir mein hai: koi raaz (password, hostname) bahar
// nahi jana chahiye.
// ═══════════════════════════════════════════════════════════════════════════

const test = require('node:test');
const assert = require('node:assert');

const { describeDbError } = require('../config/dbStatus');

const withEnv = (value, fn) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try { return fn(); } finally { process.env.NODE_ENV = previous; }
};

const named = (name, message) => Object.assign(new Error(message), { name });

test('a missing MONGO_URI is reported as configuration, not a network fault', () => {
  const d = describeDbError(new Error('MONGO_URI is not set. Add it to .env ...'));
  assert.strictEqual(d.code, 'NOT_CONFIGURED');
  assert.match(d.reason, /not set/i);
});

// Live deployment par bilkul yahi hua tha
test('a server-selection timeout points at Atlas Network Access', () => {
  const d = describeDbError(named(
    'MongooseServerSelectionError',
    'connection timed out to cluster0.ee5b2pp.mongodb.net:27017'
  ));
  assert.strictEqual(d.code, 'UNREACHABLE');
  assert.match(d.reason, /0\.0\.0\.0\/0/);
});

test('a DNS failure is also reported as unreachable', () => {
  const d = describeDbError(named('Error', 'querySrv ENOTFOUND _mongodb._tcp.cluster0.example.net'));
  assert.strictEqual(d.code, 'UNREACHABLE');
});

test('a wrong password is reported as credentials, not unreachable', () => {
  const d = describeDbError(named('MongoServerError', 'Authentication failed.'));
  assert.strictEqual(d.code, 'BAD_CREDENTIALS');
  assert.match(d.reason, /username and password/i);
});

// Atlas auth failure aksar ServerSelectionError ke andar chupi hoti hai —
// agar hum sirf error ka naam dekhein to ghalat jawab dete
test('an auth failure wrapped in a selection error is still credentials', () => {
  const d = describeDbError(named(
    'MongooseServerSelectionError',
    'bad auth : authentication failed'
  ));
  assert.strictEqual(d.code, 'BAD_CREDENTIALS');
});

test('a malformed connection string is reported as a bad URI', () => {
  const d = describeDbError(named('MongoParseError', 'Invalid scheme, expected connection string'));
  assert.strictEqual(d.code, 'BAD_URI');
});

test('an unrecognised error falls back to UNKNOWN rather than guessing', () => {
  const d = describeDbError(named('TypeError', 'something entirely unexpected'));
  assert.strictEqual(d.code, 'UNKNOWN');
});

test('every classification returns a non-empty, actionable reason', () => {
  const errors = [
    new Error('MONGO_URI is not set'),
    named('MongooseServerSelectionError', 'timed out'),
    named('MongoServerError', 'Authentication failed.'),
    named('MongoParseError', 'Invalid scheme'),
    named('TypeError', 'weird')
  ];
  for (const err of errors) {
    const d = describeDbError(err);
    assert.ok(d.reason && d.reason.length > 20, `reason too vague for ${err.name}`);
    assert.ok(d.code, 'a code is always present');
  }
});

// ─── The one that matters most ─────────────────────────────────────────────
test('production responses never leak the connection string or hostname', () => {
  const leaky = named(
    'MongooseServerSelectionError',
    'Could not connect to mongodb+srv://admin:hunter2@cluster0.ee5b2pp.mongodb.net/exam_system'
  );

  const prod = withEnv('production', () => describeDbError(leaky));
  const serialised = JSON.stringify(prod);

  assert.strictEqual(prod.detail, undefined, 'no raw detail in production');
  assert.ok(!serialised.includes('hunter2'), 'password must never be returned');
  assert.ok(!serialised.includes('mongodb+srv'), 'connection string must never be returned');
  assert.ok(!serialised.includes('ee5b2pp'), 'cluster hostname must never be returned');

  // Development mein detail milti hai — debugging ke liye
  const dev = withEnv('development', () => describeDbError(leaky));
  assert.ok(dev.detail, 'detail is available outside production');
});
