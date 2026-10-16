import { describe, it, expect } from 'vitest';
import { DEMO_PRESETS } from '../src/data/presets.js';
import { evaluateDisparity } from '../src/engine/disparityEngine.js';

describe('Demo Presets Engine Consistency Tests', () => {
  DEMO_PRESETS.forEach((preset) => {
    it(`Preset "${preset.id}" verdict matches engine evaluation`, () => {
      const result = evaluateDisparity(preset.message, preset.uri);
      expect(result.verdict).toBe(preset.expected);
    });
  });
});
