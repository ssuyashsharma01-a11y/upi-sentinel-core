import { describe, it, expect } from 'vitest';
import { VERDICT_I18N, SIGNAL_I18N } from '../src/i18n/verdicts.js';
import { SUPPORTED_LANGUAGES } from '../src/i18n/languages.js';

const VERDICT_KEYS = [
  'MALFORMED_PAYLOAD',
  'CRITICAL_INTENT_DISPARITY',
  'HIGH_INTENT_DISPARITY',
  'INSUFFICIENT_CONTEXT',
  'NO_DISPARITY_DETECTED'
];

describe('8-Language Regional Copy Completeness Tests', () => {
  it.each(SUPPORTED_LANGUAGES)('All verdicts contain complete text for $code ($label)', ({ code }) => {
    for (const vk of VERDICT_KEYS) {
      const v = VERDICT_I18N[vk];
      expect(v, `Missing verdict ${vk}`).toBeDefined();

      for (const field of ['badge', 'title', 'actionText', 'reason', 'recommendation']) {
        expect(v[field][code], `Missing ${code} in ${vk}.${field}`).toBeTruthy();
      }

      const oneLinerObj = v.oneLiner('500', 'Test Shop');
      expect(oneLinerObj[code], `Missing ${code} in ${vk}.oneLiner`).toBeTruthy();
    }
  });

  it.each(SUPPORTED_LANGUAGES)('All signals contain translations for $code ($label)', ({ code }) => {
    for (const [sigKey, sigObj] of Object.entries(SIGNAL_I18N)) {
      expect(sigObj[code], `Signal ${sigKey} missing language: ${code}`).toBeTruthy();
    }
  });
});
