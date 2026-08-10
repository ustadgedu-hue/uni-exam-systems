// ═══════════════════════════════════════════════════════════════════════════
// DBSTATUS.JS - Database ki kharabi ko samajhne laiq jumle mein badalta hai
// ═══════════════════════════════════════════════════════════════════════════
//
// Jab database se connection fail hota hai to Mongoose ka asli error bahut
// lamba aur ulajha hua hota hai — aur usme cluster ka hostname bhi hota hai.
// Wo seedha user ko dikhana theek nahi.
//
// Ye file us error ko ek chhote, saaf jumle mein badalti hai jo BATATA hai
// ke ab karna kya hai. /api/health isi ko istemal karta hai.
//
// ⚠️  Yahan se kabhi bhi MONGO_URI, password, ya hostname wapas na jaye.
// ═══════════════════════════════════════════════════════════════════════════

const REASONS = {
  NOT_CONFIGURED: 'MONGO_URI is not set in this environment.',
  UNREACHABLE:    'Cannot reach MongoDB. Check that Atlas Network Access allows 0.0.0.0/0 — Vercel has no fixed IP address.',
  BAD_CREDENTIALS:'The database rejected the credentials in MONGO_URI. Check the username and password.',
  BAD_URI:        'MONGO_URI is not a valid MongoDB connection string.',
  UNKNOWN:        'The database connection failed for an unexpected reason. Check the deployment logs.'
};

/**
 * Connection error ko ek mehfooz, kaam ki baat mein badalta hai.
 *
 * @param   {Error} err  Mongoose/MongoDB ka error
 * @returns {{ code: string, reason: string, detail?: string }}
 *          detail sirf non-production mein hota hai (debugging ke liye).
 */
const describeDbError = (err) => {
  const message = (err && err.message) || '';
  const name = (err && err.name) || '';

  let code;
  if (message.includes('MONGO_URI is not set')) {
    code = 'NOT_CONFIGURED';
  } else if (name === 'MongoParseError' || message.includes('Invalid scheme')) {
    code = 'BAD_URI';
  } else if (
    name === 'MongoServerError' && message.includes('Authentication failed') ||
    message.includes('bad auth') ||
    message.includes('AuthenticationFailed')
  ) {
    code = 'BAD_CREDENTIALS';
  } else if (
    name === 'MongooseServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoServerSelectionError' ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND') ||
    message.includes('ECONNREFUSED') ||
    message.includes('querySrv')
  ) {
    // Auth failure bhi kabhi kabhi ServerSelectionError ke andar chupi hoti hai
    code = /authentication failed|bad auth/i.test(message) ? 'BAD_CREDENTIALS' : 'UNREACHABLE';
  } else {
    code = 'UNKNOWN';
  }

  const described = { code, reason: REASONS[code] };

  // Asli error message sirf development mein — production mein isme cluster
  // ka hostname hota hai jo bahar nahi jana chahiye
  if (process.env.NODE_ENV !== 'production' && message) {
    described.detail = message.split('\n')[0].slice(0, 300);
  }

  return described;
};

module.exports = { describeDbError, REASONS };
