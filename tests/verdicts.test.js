import { describe, it, expect } from 'vitest';
import { VERDICT_I18N, SIGNAL_I18N } from '../src/i18n/verdicts.js';

const KEYS = [
  'MALFORMED_PAYLOAD',
  'CRITICAL_INTENT_DISPARITY',
  'HIGH_INTENT_DISPARITY',
  'INSUFFICIENT_CONTEXT',
  'NO_DISPARITY_DETECTED'
];

describe('i18n Copy Completeness Tests', () => {
  it.each(KEYS)('%s has complete en and hi fields', (k) => {
    const m = VERDICT_I18N[k];
    expect(m).toBeDefined();

    for (const f of ['badge', 'title', 'actionText', 'reason', 'recommendation']) {
      expect(m[f].en, `Missing en in ${k}.${f}`).toBeTruthy();
      expect(m[f].hi, `Missing hi in ${k}.${f}`).toBeTruthy();
    }

    const o = m.oneLiner('500', 'Test Shop');
    expect(o.en, `Missing oneLiner en in ${k}`).toBeTruthy();
    expect(o.hi, `Missing oneLiner hi in ${k}`).toBeTruthy();
  });

  it('All registered signals have en and hi translations', () => {
    for (const [key, val] of Object.entries(SIGNAL_I18N)) {
      expect(val.en, `Signal ${key} missing en`).toBeTruthy();
      expect(val.hi, `Signal ${key} missing hi`).toBeTruthy();
    }
  });
});
