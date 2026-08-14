// ═══════════════════════════════════════════════════════════════════════════
// DATETIME UTILITY - Saara waqt Pakistan ke hisaab se
// ═══════════════════════════════════════════════════════════════════════════
//
// Is file se pehle do masle the:
//
// 1. GHALAT WAQT SAVE HO RAHA THA (bara masla)
//    <input type="datetime-local"> se aisi string milti hai: "2026-08-15T14:30"
//    Is mein timezone ka koi zikr NAHI hota. JavaScript ka usool ye hai ke
//    aisi string ko wo JAHAN chal rahi ho wahan ka waqt maan leta hai.
//
//    Aap ka laptop Pakistan mein hai → 2:30 pm sahi save hota tha.
//    Vercel ka server UTC par chalta hai → wahi string 2:30 pm UTC bani,
//    yani Pakistan ka 7:30 pm. Paanch ghante ka farq!
//
//    Hal: browser se bhejne se PEHLE hi saaf saaf likh do ke ye Pakistan ka
//    waqt hai → "2026-08-15T14:30:00+05:00". Ab server ko andaza nahi lagana
//    parta.
//
// 2. HAR DEVICE PAR ALAG DIKHTA THA
//    toLocaleString() bagair kisi setting ke wo waqt dikhata hai jo dekhne
//    wale ke computer par set hai. Amreeka ke computer par exam ka waqt
//    amreeki waqt mein dikhta tha.
//
//    Hal: hamesha 'Asia/Karachi' likh kar dikhao — chahe koi kahin se dekhe.
//
// NOTE: Pakistan mein 2009 se daylight saving (ghari aage peeche karna) nahi
//       hoti, isliye saara saal +05:00 rehta hai. Koi library ki zaroorat nahi.
// ═══════════════════════════════════════════════════════════════════════════

export const PK_TIMEZONE = 'Asia/Karachi';
export const PK_OFFSET = '+05:00';

// Jab date na ho to table mein ye dikhate hain
const EMPTY = '—';

// 'YYYY-MM-DDTHH:mm' — datetime-local input ki shakl (seconds ke bagair)
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
// wahi, lekin seconds ke saath — kuch browsers seconds bhi dete hain
const NAIVE_DATETIME_WITH_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * datetime-local ki naive string ko Pakistan ke waqt ka pakka ISO bana deta hai.
 *
 *   '2026-08-15T14:30'  →  '2026-08-15T14:30:00+05:00'
 *
 * Jis string mein timezone pehle se mojood ho, use haath nahi lagata.
 * Khaali ya ghalat input waisi hi wapas — form validation ka kaam form ka hai.
 */
export const toPakistanISO = (value) => {
  if (!value || typeof value !== 'string') return value;

  if (NAIVE_DATETIME.test(value)) return `${value}:00${PK_OFFSET}`;
  if (NAIVE_DATETIME_WITH_SECONDS.test(value)) return `${value}${PK_OFFSET}`;

  // Pehle se offset ya 'Z' laga hai — chhero mat
  return value;
};

// Har formatter isi ke zariye chalta hai: pehle date banao, ghalat ho to '—'
const format = (value, options) => {
  if (value === null || value === undefined || value === '') return EMPTY;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;

  // 'en-GB' isliye ke wo mahina pehle nahi lagata (15 Aug, na ke Aug 15)
  return date.toLocaleString('en-GB', { timeZone: PK_TIMEZONE, ...options });
};

/** '15 Aug 2026, 02:30 pm' — Pakistan ka waqt, har device par ek jaisa */
export const formatDateTime = (value) => format(value, {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true
});

/** '15 Aug 2026' */
export const formatDate = (value) => format(value, {
  day: '2-digit', month: 'short', year: 'numeric'
});

/** '02:30 pm' */
export const formatTime = (value) => format(value, {
  hour: '2-digit', minute: '2-digit', hour12: true
});
