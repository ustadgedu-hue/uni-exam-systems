// ═══════════════════════════════════════════════════════════════════════════
// DATETIME TESTS
// ═══════════════════════════════════════════════════════════════════════════
//
// In tests ki poori baat ye hai: nateeja machine ke waqt par nahi hona
// chahiye. Har expectation ek maloom lamhe (09:30 UTC) par pakki hai, aur
// helpers khud 'Asia/Karachi' likhte hain — isliye ye tests kisi bhi
// timezone mein wahi jawab denge.
//
// Isay saabit karne ke liye poora suite dobara doosre timezone mein chalayen:
//     TZ=America/New_York npm test
// Dono baar nateeja bilkul aik jaisa aana chahiye.
//
// NOTE: yahan `process.env.TZ` set karna bekaar hai — Node apna timezone
// shuru hote hi cache kar leta hai, isliye TZ bahar se dena parta hai.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @jest-environment node
 */

const { toPakistanISO, formatDateTime, formatDate, formatTime, PK_OFFSET } = require('./datetime');

// 15 Aug 2026, 2:30 pm Pakistan = 09:30 UTC
const PKT_230PM = '2026-08-15T09:30:00.000Z';

describe('toPakistanISO — fixes exams being stored 5 hours late', () => {
  it('tags a naive datetime-local value as Pakistan time', () => {
    expect(toPakistanISO('2026-08-15T14:30')).toBe('2026-08-15T14:30:00+05:00');
  });

  // Ye asli regression hai: 2:30 pm ka matlab 09:30 UTC hona chahiye, 14:30 UTC nahi
  it('makes 2:30 pm resolve to 09:30 UTC no matter where the code runs', () => {
    const iso = toPakistanISO('2026-08-15T14:30');
    expect(new Date(iso).toISOString()).toBe(PKT_230PM);
  });

  it('is what the OLD code got wrong', () => {
    // Purana tareeqa: naive string seedha bheji jati thi. UTC server par
    // ye 14:30 UTC banti thi — yani Pakistan ka 7:30 pm.
    const oldWay = new Date('2026-08-15T14:30Z').toISOString();
    const newWay = new Date(toPakistanISO('2026-08-15T14:30')).toISOString();

    expect(oldWay).toBe('2026-08-15T14:30:00.000Z');   // 7:30 pm PKT — galat
    expect(newWay).toBe(PKT_230PM);                     // 2:30 pm PKT — sahi

    const hoursApart = (new Date(oldWay) - new Date(newWay)) / 3600000;
    expect(hoursApart).toBe(5);
  });

  it('handles browsers that include seconds', () => {
    expect(toPakistanISO('2026-08-15T14:30:00')).toBe('2026-08-15T14:30:00+05:00');
  });

  it('leaves a value that already has a timezone alone', () => {
    expect(toPakistanISO('2026-08-15T09:30:00Z')).toBe('2026-08-15T09:30:00Z');
    expect(toPakistanISO('2026-08-15T14:30:00+05:00')).toBe('2026-08-15T14:30:00+05:00');
  });

  it('passes empty and non-string input straight through for the form to validate', () => {
    expect(toPakistanISO('')).toBe('');
    expect(toPakistanISO(null)).toBe(null);
    expect(toPakistanISO(undefined)).toBe(undefined);
  });

  it('exports the fixed +05:00 offset (Pakistan has no daylight saving)', () => {
    expect(PK_OFFSET).toBe('+05:00');
  });
});

describe('formatters — always Pakistan time, never the viewer’s device', () => {
  it('formatDateTime renders 09:30 UTC as 2:30 pm Pakistan time', () => {
    expect(formatDateTime(PKT_230PM)).toBe('15 Aug 2026, 02:30 pm');
  });

  // Ye tab pakadta hai jab koi timeZone hata de: kisi bhi doosre timezone
  // mein 09:30 UTC ka waqt 2:30 pm ke ilawa kuch aur banta hai
  // (New York = 5:30 am, London = 10:30 am, UTC = 9:30 am).
  it('does not fall back to the machine timezone', () => {
    const out = formatDateTime(PKT_230PM);
    expect(out).toContain('02:30 pm');
    for (const otherTimezoneRendering of ['05:30', '5:30', '10:30', '09:30', '9:30']) {
      expect(out).not.toContain(otherTimezoneRendering);
    }
  });

  it('formatDate gives a spelled month so 15/08 can’t be misread as Aug 15', () => {
    expect(formatDate(PKT_230PM)).toBe('15 Aug 2026');
  });

  it('formatTime gives just the time', () => {
    expect(formatTime(PKT_230PM)).toBe('02:30 pm');
  });

  it('accepts a Date object as well as a string', () => {
    expect(formatDateTime(new Date(PKT_230PM))).toBe('15 Aug 2026, 02:30 pm');
  });

  it('rolls the date over correctly near midnight Pakistan time', () => {
    // 20:00 UTC on 14 Aug = 01:00 on 15 Aug in Pakistan
    expect(formatDate('2026-08-14T20:00:00.000Z')).toBe('15 Aug 2026');
  });

  it('shows an em dash for missing or invalid values instead of "Invalid Date"', () => {
    for (const bad of [null, undefined, '', 'not-a-date']) {
      expect(formatDateTime(bad)).toBe('—');
      expect(formatDate(bad)).toBe('—');
      expect(formatTime(bad)).toBe('—');
    }
  });
});
