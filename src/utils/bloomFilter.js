/**
 * Zero-Knowledge Compact Bloom Filter for Client-Side VPA Blocklist.
 * Uses Double Hashing (Kirsch-Mitzenmacher-style) to generate k hash locations
 * without external heavy cryptography dependencies.
 */
export class BloomFilter {
  constructor(sizeInBits = 131072, numHashes = 5) {
    this.size = sizeInBits;
    this.numHashes = numHashes;
    this.bitArray = new Uint8Array(Math.ceil(sizeInBits / 8));
  }

  // FNV-1a 32-bit Hash
  static fnv1a(str, seed = 0x811c9dc5) {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  // Double Hashing: h_i(x) = (h1(x) + i * h2(x)) mod size
  getHashIndices(item) {
    const h1 = BloomFilter.fnv1a(item, 0x811c9dc5);
    const h2 = BloomFilter.fnv1a(item, 0x9e3779b9) || 1;
    const indices = [];

    for (let i = 0; i < this.numHashes; i++) {
      const idx = (h1 + i * h2) % this.size;
      indices.push(idx);
    }
    return indices;
  }

  add(item) {
    const indices = this.getHashIndices(item);
    for (const idx of indices) {
      const byteIdx = Math.floor(idx / 8);
      const bitMask = 1 << (idx % 8);
      this.bitArray[byteIdx] |= bitMask;
    }
  }

  has(item) {
    const indices = this.getHashIndices(item);
    for (const idx of indices) {
      const byteIdx = Math.floor(idx / 8);
      const bitMask = 1 << (idx % 8);
      if ((this.bitArray[byteIdx] & bitMask) === 0) {
        return false; // Definitely not in set
      }
    }
    return true; // Probable match
  }

  exportBase64() {
    let binary = '';
    const len = this.bitArray.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(this.bitArray[i]);
    }
    return btoa(binary);
  }

  static fromBase64(base64Str, sizeInBits = 131072, numHashes = 5) {
    const filter = new BloomFilter(sizeInBits, numHashes);
    const binary = atob(base64Str);
    for (let i = 0; i < binary.length; i++) {
      filter.bitArray[i] = binary.charCodeAt(i);
    }
    return filter;
  }
}

// Client-side quick VPA normalizer
export function normalizeVpa(vpa) {
  if (!vpa) return '';
  return vpa.trim().toLowerCase();
}
