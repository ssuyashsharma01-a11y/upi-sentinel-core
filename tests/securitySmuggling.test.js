import { describe, it, expect } from 'vitest';
import { parseUpiUri } from '../src/utils/upiParser.js';
import { normalizeSecurityText, extractAllAmounts, evaluateDisparity } from '../src/engine/disparityEngine.js';

describe('Security Hardening & Anti-Bypass Invariants', () => {
  it('catches URL-encoded duplicate parameter smuggling (%61m=5000 vs am=1)', () => {
    const smuggledUri = 'upi://pay?pa=merchant@ybl&am=1&%61m=5000';
    const parsed = parseUpiUri(smuggledUri);
    expect(parsed.isValid).toBe(false);
    expect(parsed.isSmuggled).toBe(true);
    expect(parsed.error).toContain('Duplicate query parameter');
  });

  it('rejects schemes bypassing prefix checks (e.g., upi://payment)', () => {
    const fakeSchemeUri = 'upi://payment?pa=test@ybl&am=100';
    const parsed = parseUpiUri(fakeSchemeUri);
    expect(parsed.isValid).toBe(false);
  });

  it('normalizes zero-width characters and Devanagari numerals (०-९)', () => {
    const zeroWidthMsg = 'bhej\u200Bdiya \u096B\u0966\u0966';
    const normalized = normalizeSecurityText(zeroWidthMsg);
    expect(normalized).toBe('bhejdiya 500');
  });

  it('correctly parses comma-separated amounts and currency tokens', () => {
    const text = 'Sir refund of \u20B95,000 sent, approve now';
    const amounts = extractAllAmounts(text);
    expect(amounts).toEqual([5000]);
  });

  it('does not falsely capture non-currency numbers as payment amounts', () => {
    const text = '2 din me aayega call at 4 digit PIN';
    const amounts = extractAllAmounts(text);
    expect(amounts).toEqual([]);
  });

  it('handles query parameters containing nested equals without data corruption', () => {
    const uri = 'upi://pay?pa=vendor@okhdfcbank&tn=order=id=999&am=250';
    const parsed = parseUpiUri(uri);
    expect(parsed.isValid).toBe(true);
    expect(parsed.params.tn).toBe('order=id=999');
  });

  it('triggers critical inversion on Devanagari PIN directives', () => {
    const context = '\u092a\u0948\u0938\u0947 \u092a\u093e\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0924\u0941\u0930\u0902\u0924 \u0905\u092a\u0928\u093e \u092a\u093f\u0928 \u0921\u093e\u0932\u0947\u0902';
    const uri = 'upi://pay?pa=scammer@ybl&am=2000';
    const evaluation = evaluateDisparity(context, uri);
    expect(evaluation.verdict).toBe('CRITICAL_INTENT_DISPARITY');
  });

  it('negative test: legitimate Hindi message yields NO_DISPARITY_DETECTED', () => {
    // "बिजली का बिल भर रहा हूँ" + legitimate merchant
    const context = '\u092c\u093f\u091c\u0932\u0940 \u0915\u093e \u092c\u093f\u0932 \u092d\u0930 \u0930\u0939\u093e \u0939\u0942\u0901';
    const uri = 'upi://pay?pa=powerbill@billdesk&am=450';
    const evaluation = evaluateDisparity(context, uri);
    expect(evaluation.verdict).toBe('NO_DISPARITY_DETECTED');
  });

  it('catches institutional impersonation on consumer PSP handles', () => {
    const fakeArmy = 'upi://pay?pa=fakecanteen@ybl&pn=Army%20HQ%20Canteen&am=1200';
    const evaluation = evaluateDisparity('Paying for canteen mess', fakeArmy);
    expect(evaluation.verdict).toBe('HIGH_INTENT_DISPARITY');
  });
});