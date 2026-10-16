import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateDisparity } from '../src/engine/disparityEngine.js';

const SCAM_PHRASES = [
  'advance bhej diya',
  'PIN dalo accept karo',
  'scan to receive',
  'claim your cashback',
  'power disconnected tonight',
  'unpaid bill pay immediately'
];

const URIS = [
  'upi://pay?pa=scammer@ybl&pn=Buyer&am=5000&cu=INR',
  'upi://pay?pa=discom.update@paytm&pn=Electricity&am=120&cu=INR',
  'upi://pay?pa=guptakirana@icici&pn=Gupta%20Store&am=110&cu=INR'
];

describe('Meaningful Monotonicity & Security Invariants', () => {
  it('Adding reverse-charge directives to any baseline never makes verdict safer', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SCAM_PHRASES),
        fc.constantFrom(...URIS),
        (scamPhrase, uri) => {
          const res = evaluateDisparity(scamPhrase, uri);
          // A scam directive can never yield clean green
          expect(res.verdict).not.toBe('NO_DISPARITY_DETECTED');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Adding urgency prefix to a reverse charge trap never downgrades it below HIGH/CRITICAL', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('URGENT NOTICE! ', 'IMMEDIATE ACTION REQUIRED: ', 'ALERT: '),
        fc.constantFrom(...SCAM_PHRASES),
        fc.constantFrom(...URIS),
        (urgency, scam, uri) => {
          const res = evaluateDisparity(`${urgency} ${scam}`, uri);
          expect(['CRITICAL_INTENT_DISPARITY', 'HIGH_INTENT_DISPARITY']).toContain(res.verdict);
        }
      ),
      { numRuns: 100 }
    );
  });
});
