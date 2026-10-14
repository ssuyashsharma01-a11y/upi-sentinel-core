import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { evaluateDisparity } from '../src/engine/disparityEngine.js';

const fixturesPath = path.resolve(__dirname, '../test_fixtures.json');
const rawData = fs.readFileSync(fixturesPath, 'utf8');
const fixtures = JSON.parse(rawData.replace(/^\uFEFF/, ''));

describe('UPI Sentinel Intent-to-Action Disparity Engine (IADE v3.0)', () => {
  fixtures.forEach((fixture) => {
    it(`Test #${fixture.id}: ${fixture.scenario}`, () => {
      const result = evaluateDisparity(fixture.text, fixture.uri);
      expect(result.verdict).toBe(fixture.expected_verdict);
    });
  });
});