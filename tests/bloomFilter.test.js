import { describe, it, expect } from 'vitest';
import { BloomFilter, normalizeVpa } from '../src/utils/bloomFilter.js';
import { isVpaFlaggedInRadar } from '../src/utils/threatIntel.js';
import { evaluateDisparity } from '../src/engine/disparityEngine.js';

describe('Zero-Knowledge Bloom Filter Threat Radar Tests', () => {
  it('Should guarantee ZERO false negatives for added threats', () => {
    const filter = new BloomFilter(65536, 4);
    const threats = [
      'scammer1@okhdfcbank',
      'olxtrap@paytm',
      'lottery2026@upi'
    ];

    threats.forEach(t => filter.add(normalizeVpa(t)));

    // Every added threat MUST return true
    threats.forEach(t => {
      expect(filter.has(normalizeVpa(t))).toBe(true);
    });

    // Unrelated clean VPA should not trigger
    expect(filter.has('clean.merchant.supermarket@icici')).toBe(false);
  });

  it('Serializes to Base64 and deserializes losslessly', () => {
    const original = new BloomFilter(1024, 3);
    original.add('testscam@ybl');

    const b64 = original.exportBase64();
    const restored = BloomFilter.fromBase64(b64, 1024, 3);

    expect(restored.has('testscam@ybl')).toBe(true);
    expect(restored.has('notinthefilter@ybl')).toBe(false);
  });

  it('Disparity Engine catches seed threat radar VPA instantly', () => {
    // armycanteenrefund@okaxis is in our seed threat list
    const res = evaluateDisparity(
      'Payment for goods',
      'upi://pay?pa=armycanteenrefund@okaxis&pn=ArmyStore&am=2000'
    );

    expect(res.verdict).toBe('CRITICAL_INTENT_DISPARITY');
    const hasRadarSignal = res.signals.some(s => s.id === 'COMMUNITY_THREAT_RADAR_MATCH');
    expect(hasRadarSignal).toBe(true);
  });
});
