import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateDisparity } from '../src/engine/disparityEngine.js';

const SEVERITY = {
  NO_DISPARITY_DETECTED: 1,
  INSUFFICIENT_CONTEXT: 2,
  HIGH_INTENT_DISPARITY: 3,
  CRITICAL_INTENT_DISPARITY: 4,
  MALFORMED_PAYLOAD: 0
};

describe('IADE v3.2 Mathematical Monotonicity Invariants', () => {
  it('Property 1: Adding urgency signals NEVER decreases verdict severity', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom(
          'upi://pay?pa=shop@icici&pn=Shop&am=100&cu=INR',
          'upi://pay?pa=fake99@ybl&pn=Army%20HQ&am=5000&cu=INR',
          'upi://pay?pa=driver@paytm&pn=Driver&am=300&cu=INR'
        ),
        (msg, uri) => {
          const baseVerdict = evaluateDisparity(msg, uri).verdict;
          const urgentMsg = `URGENT! Power disconnected! ${msg}`;
          const urgentVerdict = evaluateDisparity(urgentMsg, uri).verdict;
          
          if (SEVERITY[baseVerdict] > 0) {
            // Severity must remain equal or increase
            expect(SEVERITY[urgentVerdict]).toBeGreaterThanOrEqual(SEVERITY[baseVerdict]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Adding PIN directive NEVER decreases verdict severity', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom(
          'upi://pay?pa=test@okhdfcbank&pn=Merchant&am=500&cu=INR',
          'upi://pay?pa=fakeuser@ybl&pn=HQ&am=2000&cu=INR'
        ),
        (msg, uri) => {
          const baseVerdict = evaluateDisparity(msg, uri).verdict;
          const pinMsg = `${msg} scan karke PIN dalo`;
          const pinVerdict = evaluateDisparity(pinMsg, uri).verdict;
          
          if (SEVERITY[baseVerdict] > 0) {
            expect(SEVERITY[pinVerdict]).toBeGreaterThanOrEqual(SEVERITY[baseVerdict]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});