import fs from 'fs';
import { evaluateDisparity } from '../src/engine/disparityEngine.js';

const fixtureFile = fs.existsSync('test_fixtures.json') 
  ? 'test_fixtures.json' 
  : (fs.existsSync('tests/fixtures.json') ? 'tests/fixtures.json' : null);

if (!fixtureFile) {
  console.error("Fixture file not found!");
  process.exit(1);
}

const raw = fs.readFileSync(fixtureFile, 'utf8').replace(/^\uFEFF/, '');
const fixtures = JSON.parse(raw);
let failures = 0;

console.log(`Running diagnostics across ${fixtures.length} fixtures...\n`);

for (const f of fixtures) {
  const r = evaluateDisparity(f.text, f.uri);
  if (r.verdict !== f.expected_verdict) {
    failures++;
    console.log(`❌ #${f.id} ${f.scenario}`);
    console.log(`   Text: "${f.text}"`);
    console.log(`   URI:  "${f.uri}"`);
    console.log(`   Expected: [${f.expected_verdict}]`);
    console.log(`   Received: [${r.verdict}]`);
    console.log(`   Reason:   ${r.reason}\n`);
  }
}

if (failures === 0) {
  console.log(`✅ All ${fixtures.length}/${fixtures.length} fixtures passed with general heuristics!`);
} else {
  console.log(`⚠️ Total Failures: ${failures}/${fixtures.length}`);
}
