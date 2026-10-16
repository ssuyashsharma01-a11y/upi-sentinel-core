/**
 * UPI Sentinel Security Hardening Utilities
 * Addresses parameter smuggling, unicode normalization, and decoy payload analysis.
 */

// 1. Text Normalization: NFKC + Strip Zero-Width + Devanagari to ASCII digits
export function normalizeSecurityText(input = '') {
  if (typeof input !== 'string') return '';
  const zeroWidthRegex = /[\u200B-\u200D\u2060\uFEFF]/g;
  let normalized = input.normalize('NFKC').replace(zeroWidthRegex, '').toLowerCase().trim();
  // Map Devanagari numerals (०-९) to ASCII (0-9)
  normalized = normalized.replace(/[\u0966-\u096F]/g, d => String(d.charCodeAt(0) - 0x0966));
  return normalized;
}

// 2. Parameter Smuggling & URL-Decode Bypass Guard
export function parseUpiUriSecure(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') {
    return { isValid: false, error: 'Empty or non-string URI' };
  }

  try {
    const trimmed = rawUri.trim();
    if (!trimmed.toLowerCase().startsWith('upi://pay')) {
      return { isValid: false, error: 'Invalid or unsupported scheme' };
    }

    const queryIndex = trimmed.indexOf('?');
    if (queryIndex === -1) {
      return { isValid: false, error: 'Missing URI query parameters' };
    }

    const rawQuery = trimmed.slice(queryIndex + 1);
    const rawPairs = rawQuery.split('&');
    const seenKeys = new Set();
    const params = {};

    for (const pair of rawPairs) {
      if (!pair) continue;
      const [rawK, rawV = ''] = pair.split('=');
      const decodedKey = decodeURIComponent(rawK).trim().toLowerCase();
      const decodedVal = decodeURIComponent(rawV).trim();

      // Parameter Smuggling Catch (e.g., am=1&%61m=5000)
      if (seenKeys.has(decodedKey)) {
        return {
          isValid: false,
          error: `Duplicate query parameter detected: ${decodedKey}`,
          isSmuggled: true
        };
      }
      seenKeys.add(decodedKey);
      params[decodedKey] = decodedVal;
    }

    // Strict VPA validation
    const vpaRegex = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
    if (!params.pa || !vpaRegex.test(params.pa)) {
      return { isValid: false, error: 'Malformed or invalid VPA handle' };
    }

    return { isValid: true, params };
  } catch (err) {
    return { isValid: false, error: 'Malformed URI encoding' };
  }
}

// 3. Decoy & Multiple Amount Extraction
export function extractAllAmounts(text) {
  if (!text || typeof text !== 'string') return [];
  const normalized = normalizeSecurityText(text);
  const regex = /(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:\/-)?/gi;
  const amounts = [];
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) {
      amounts.push(val);
    }
  }
  return amounts;
}
