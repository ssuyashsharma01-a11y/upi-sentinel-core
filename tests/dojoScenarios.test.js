import { describe, it, expect } from 'vitest';
import { DOJO_SCENARIOS } from '../src/data/dojoScenarios.js';
import { evaluateDisparity } from '../src/engine/disparityEngine.js';

describe('Scam Simulator Dojo Scenarios Integration Tests', () => {
  it('Verifies all 5 scenarios trigger CRITICAL or HIGH disparity', () => {
    expect(DOJO_SCENARIOS.length).toBe(5);

    DOJO_SCENARIOS.forEach(scenario => {
      const result = evaluateDisparity(scenario.message, scenario.uri);

      // Har scam scenario ko engine suspicious mark kare (Never clean/green)
      expect(result.verdict).not.toBe('NO_DISPARITY_DETECTED');
      expect(['CRITICAL_INTENT_DISPARITY', 'HIGH_INTENT_DISPARITY']).toContain(result.verdict);
      expect(result.signals.length).toBeGreaterThan(0);
    });
  });

  it('Verifies OLX Advance trap is caught as CRITICAL intent disparity', () => {
    const olx = DOJO_SCENARIOS.find(s => s.id === 'olx_advance');
    const result = evaluateDisparity(olx.message, olx.uri);
    expect(result.verdict).toBe('CRITICAL_INTENT_DISPARITY');
  });

  it('Verifies Discom cutoff triggers urgency intimidation heuristics', () => {
    const discom = DOJO_SCENARIOS.find(s => s.id === 'discom_cutoff');
    const result = evaluateDisparity(discom.message, discom.uri);
    expect(result.signals.some(s => s.id === 'URGENCY_INTIMIDATION')).toBe(true);
  });
});
