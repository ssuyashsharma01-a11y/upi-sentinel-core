import { describe, it, expect } from 'vitest';
import { evaluateDisparity as E } from '../src/engine/disparityEngine.js';

const U = (pa, pn, am) => `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR`;

describe('Reviewer Probe Test Matrix', () => {
  it('Scam text plus an urgency prefix stays CRITICAL or HIGH (Never downgrades or greens)', () => {
    const res = E(
      'URGENT! advance Rs 5000 bhej diye hain. QR scan karke PIN dalo',
      U('scam77@ybl', 'Buyer', 5000)
    );
    expect(res.verdict).toBe('CRITICAL_INTENT_DISPARITY');
  });

  it('Fake "RBI Refund Desk" handle with "Paying bill" is caught by impersonation check (Never green)', () => {
    const res = E(
      'Paying bill',
      U('bill.refund@paytm', 'RBI Refund Desk', 999)
    );
    expect(res.verdict).not.toBe('NO_DISPARITY_DETECTED');
    expect(res.verdict).toBe('HIGH_INTENT_DISPARITY');
  });

  it('"I am paying you Rs 5000, check your app" is CRITICAL (Never green)', () => {
    const res = E(
      'I am paying you Rs 5000, check your app',
      U('trapuser@ybl', 'OnlineBuyer', 5000)
    );
    expect(res.verdict).toBe('CRITICAL_INTENT_DISPARITY');
  });

  it('Scam text with stuffed words "tea milk bill payment" is NEVER green', () => {
    const res = E(
      'tea milk bill payment advance Rs 5000 bhej diye hain PIN dalo',
      U('fraud@ybl', 'Tea Stall', 5000)
    );
    expect(res.verdict).toBe('CRITICAL_INTENT_DISPARITY');
  });

  it('Payment of Rs 5000 received. Scan to claim your payment is CRITICAL', () => {
    const res = E(
      'Payment of Rs 5000 received. Scan to claim your payment.',
      U('buyer77@ybl', 'Buyer', 5000)
    );
    expect(res.verdict).toBe('CRITICAL_INTENT_DISPARITY');
  });

  it('Free tea voucher! Scan to receive Rs 2000 cashback is CRITICAL', () => {
    const res = E(
      'Free tea voucher! Scan to receive Rs 2000 cashback',
      U('cashback77@ybl', 'Rewards', 2000)
    );
    expect(res.verdict).toBe('CRITICAL_INTENT_DISPARITY');
  });

  it('Bank never asks for PIN. Maine 5000 bhej diya hai, PIN dalo accept karo is CRITICAL', () => {
    const res = E(
      'Bank never asks for PIN. Maine 5000 bhej diya hai, PIN dalo accept karo',
      U('fakeofficer99@ybl', 'Army HQ Canteen', 5000)
    );
    expect(res.verdict).toBe('CRITICAL_INTENT_DISPARITY');
  });
});
