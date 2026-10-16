import { BloomFilter, normalizeVpa } from './bloomFilter.js';
import threatData from '../data/threatRadar.js';

let memoizedFilter = null;

export function getThreatRadarFilter() {
  if (memoizedFilter) return memoizedFilter;

  // Initialize a 128Kb bit-array filter (16KB memory footprint)
  const filter = new BloomFilter(threatData.size_bits, threatData.hashes_count);
  for (const vpa of threatData.seed_threats) {
    filter.add(vpa);
  }
  memoizedFilter = filter;
  return memoizedFilter;
}

export function isVpaFlaggedInRadar(rawVpa = '') {
  if (!rawVpa) return false;
  const filter = getThreatRadarFilter();
  return filter.has(rawVpa);
}