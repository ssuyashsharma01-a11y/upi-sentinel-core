import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { evaluateDisparity } from '../src/engine/disparityEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesPath = path.resolve(__dirname, '../test_fixtures.json');
const rawData = fs.readFileSync(fixturesPath, 'utf8');
const fixtures = JSON.parse(rawData.replace(/^\uFEFF/, ''));

console.log('----------------------------------------------------');
console.log('UPI Sentinel (IADE) Benchmark & Regression Audit');
console.log(`Evaluating ${fixtures.length} standardized vectors...`);
console.log('----------------------------------------------------');

const WARMUP_RUNS = 10;
const BENCHMARK_RUNS = 500;

for (let i = 0; i < WARMUP_RUNS; i++) {
  for (const f of fixtures) {
    evaluateDisparity(f.text, f.uri);
  }
}

let correct = 0;
const start = performance.now();

for (let i = 0; i < BENCHMARK_RUNS; i++) {
  for (const f of fixtures) {
    const res = evaluateDisparity(f.text, f.uri);
    if (i === 0 && res.verdict === f.expected_verdict) {
      correct++;
    }
  }
}

const totalTime = performance.now() - start;
const totalEvaluations = BENCHMARK_RUNS * fixtures.length;
const latencyPerOp = (totalTime / totalEvaluations) * 1000;
const opsPerSec = Math.round((totalEvaluations / (totalTime / 1000)));
const accuracy = ((correct / fixtures.length) * 100).toFixed(1);

console.log(`Accuracy Score:      ${correct}/${fixtures.length} (${accuracy}%)`);
console.log(`Total Operations:    ${totalEvaluations.toLocaleString()}`);
console.log(`Throughput:          ${opsPerSec.toLocaleString()} evals/sec`);
console.log(`Average Latency:     ${latencyPerOp.toFixed(2)} µs/eval`);
console.log('----------------------------------------------------');
console.log('Status: Benchmark completed successfully.');