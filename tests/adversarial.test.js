import { describe, it, expect } from 'vitest';
import { evaluateDisparity as E } from '../src/engine/disparityEngine.js';

const U = (pa, pn, am) => `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR`;

const CASES = [
  ['claim payment', 'Payment of Rs 5000 received. Scan to claim your payment.', U('buyer77@ybl', 'Buyer', 5000)],
  ['bill threat variant', 'Your power will be disconnected at 9:30 PM due to unpaid bill. Pay bill now.', U('discom.pay@icici', 'Discom Power', 120)],
  ['paying-you advance', 'Paying you the advance, just scan this QR to receive', U('olxbuyer@ybl', 'OLX Buyer', 4000)],
  ['awareness prefix', 'Bank never asks for PIN. Maine 5000 bhej diya hai, PIN dalo accept karo', U('fakeofficer99@ybl', 'Army HQ Canteen', 5000)],
  ['tea stuffing', 'Free tea voucher! Scan QR to receive Rs 2000 cashback', U('cashback77@ybl', 'Rewards', 2000)],
  ['fake bill handle', '', U('bill.refund@paytm', 'RBI Refund Desk', 999)],
  ['fake officer handle', '', U('fakeofficer99@ybl', 'Army HQ Canteen', 5000)]
];

describe('Adversarial Security Probes', () => {
  it.each(CASES)('%s is never green', (_n, m, u) => {
    const res = E(m, u);
    expect(res.verdict).not.toBe('NO_DISPARITY_DETECTED');
  });
});
