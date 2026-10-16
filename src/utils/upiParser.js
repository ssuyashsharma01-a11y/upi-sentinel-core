/**
 * Safe client-side UPI URI / VPA parser.
 * Handles both upi://pay URI schemes and raw VPA strings.
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
    params: {}
  };

  if (!input) return emptyResult;

  // 1. Raw VPA Pattern handling (e.g. merchant@ybl)
  if (/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(input)) {
    return {
      isValid: true,
      rawUri: input,
      pa: input.toLowerCase(),
      pn: input.split('@')[0],
      am: null,
      cu: 'INR',
      params: { pa: input }
    };
  }

  // 2. Standard upi://pay Scheme handling
  if (!input.toLowerCase().startsWith('upi://pay')) {
    return emptyResult;
  }

  try {
    const queryPart = input.includes('?') ? input.substring(input.indexOf('?') + 1) : '';
    if (!queryPart) return emptyResult;

    const params = {};
    const pairs = queryPart.split('&');
    for (const pair of pairs) {
      if (!pair) continue;
      const [key, val] = pair.split('=');
      if (key) {
        try {
          params[decodeURIComponent(key)] = val ? decodeURIComponent(val.replace(/\+/g, ' ')) : '';
        } catch {
          params[key] = val || '';
        }
      }
    }

    const pa = params.pa ? params.pa.trim() : null;
    if (!pa) {
      return {
        ...emptyResult,
        rawUri: input,
        params
      };
    }

    return {
      isValid: true,
      rawUri: input,
      pa: pa.toLowerCase(),
      pn: params.pn ? params.pn.trim() : null,
      am: params.am ? params.am.trim() : null,
      cu: params.cu ? params.cu.trim().toUpperCase() : 'INR',
      params
    };
  } catch {
    return emptyResult;
  }
}
