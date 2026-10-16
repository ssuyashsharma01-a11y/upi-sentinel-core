/**
 * Safe client-side UPI URI / VPA parser with Anti-Parameter-Smuggling and strict validation.
 */
export function parseUpiUri(rawInput = '') {
  const input = (rawInput || '').trim();

  const emptyResult = {
    isValid: false,
    rawUri: input,
    pa: null,
    pn: null,
    am: null,
    cu: 'INR',
    params: Object.create(null),
    error: null
  };

  if (!input) return emptyResult;

  // 1. Raw VPA Pattern handling
  const vpaStrictRegex = /^[\w.\-%]{2,256}@[a-zA-Z]{2,64}$/;
  if (vpaStrictRegex.test(input)) {
    const params = Object.create(null);
    params.pa = input;
    return {
      isValid: true,
      rawUri: input,
      pa: input.toLowerCase(),
      pn: input.split('@')[0],
      am: null,
      cu: 'INR',
      params
    };
  }

  // 2. Strict UPI Scheme check
  if (!/^upi:\/\/pay(\?|$)/i.test(input)) {
    return { ...emptyResult, error: 'Invalid or unsupported scheme' };
  }

  try {
    const queryIndex = input.indexOf('?');
    const queryPart = queryIndex !== -1 ? input.substring(queryIndex + 1) : '';
    if (!queryPart) {
      return { ...emptyResult, error: 'Missing query parameters' };
    }

    const params = Object.create(null);
    const seenKeys = new Set();
    const pairs = queryPart.split('&');

    for (const pair of pairs) {
      if (!pair) continue;
      const eqIdx = pair.indexOf('=');
      const rawK = eqIdx !== -1 ? pair.slice(0, eqIdx) : pair;
      const rawV = eqIdx !== -1 ? pair.slice(eqIdx + 1) : '';

      const decodedKey = decodeURIComponent(rawK).trim().toLowerCase();
      const decodedVal = decodeURIComponent(rawV.replace(/\+/g, ' ')).trim();

      if (seenKeys.has(decodedKey)) {
        return {
          ...emptyResult,
          error: `Duplicate query parameter detected: ${decodedKey}`,
          isSmuggled: true
        };
      }
      seenKeys.add(decodedKey);
      params[decodedKey] = decodedVal;
    }

    const pa = params.pa ? params.pa.trim() : null;
    if (!pa) {
      return {
        ...emptyResult,
        params,
        error: 'Missing or malformed pa (VPA) parameter'
      };
    }

    const cu = params.cu ? params.cu.trim().toUpperCase() : 'INR';
    if (cu !== 'INR') {
      return {
        ...emptyResult,
        params,
        error: 'Unsupported currency'
      };
    }

    let parsedAm = null;
    if (params.am) {
      const amRaw = params.am.trim();
      if (!/^\d+(\.\d{1,2})?$/.test(amRaw)) {
        return {
          ...emptyResult,
          params,
          error: 'Malformed amount numeric string'
        };
      }
      parsedAm = parseFloat(amRaw);
      if (parsedAm <= 0) {
        return {
          ...emptyResult,
          params,
          error: 'Amount must be > 0'
        };
      }
    }

    return {
      isValid: true,
      rawUri: input,
      pa: pa.toLowerCase(),
      pn: params.pn ? params.pn.trim() : null,
      am: parsedAm !== null ? String(parsedAm) : null,
      parsedAmount: parsedAm,
      cu,
      params
    };
  } catch (err) {
    return { ...emptyResult, error: 'URI decode failure' };
  }
}