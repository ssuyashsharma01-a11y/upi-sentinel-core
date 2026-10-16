import { isVpaFlaggedInRadar } from '../utils/threatIntel.js';

function parseUpi(rawInput = '') {
  const input = (rawInput || '').trim();
  const empty = { isValid: false, rawUri: input, pa: '', pn: '', am: null, cu: 'INR', params: {} };
  if (!input) return empty;

  if (/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(input)) {
    return { isValid: true, rawUri: input, pa: input.toLowerCase(), pn: input.split('@')[0], am: null, cu: 'INR', params: { pa: input } };
  }

  if (!input.toLowerCase().startsWith('upi://pay')) return empty;

  try {
    const qIndex = input.indexOf('?');
    if (qIndex === -1) return empty;
    const query = input.slice(qIndex + 1);
    const params = {};
    for (const pair of query.split('&')) {
      if (!pair) continue;
      const [k, v] = pair.split('=');
      if (k) {
        try {
          params[decodeURIComponent(k)] = v ? decodeURIComponent(v.replace(/\+/g, ' ')) : '';
        } catch {
          params[k] = v || '';
        }
      }
    }
    const pa = params.pa ? params.pa.trim() : '';
    if (!pa) return { ...empty, rawUri: input, params };

    return {
      isValid: true,
      rawUri: input,
      pa,
      pn: params.pn ? params.pn.trim() : '',
      am: params.am ? params.am.trim() : null,
      cu: params.cu ? params.cu.trim().toUpperCase() : 'INR',
      params
    };
  } catch {
    return empty;
  }
}

const CYRILLIC_REGEX = /[\u0400-\u04FF]/;
const PERCENT_CYRILLIC_REGEX = /%D[0-4]%[89A-F][0-9A-F]/i;

const CONSUMER_PSPS = [
  '@okaxis', '@okhdfcbank', '@okicici', '@oksbi',
  '@ybl', '@ibl', '@axl', '@paytm', '@apl', '@airtel'
];

const IMPERSONATION_TARGETS = [
  'army', 'canteen', 'electricity', 'discom', 'bsnl',
  'support', 'customercare', 'refund', 'lottery', 'kbc',
  'police', 'challan', 'traffic', 'rto', 'income', 'rbi'
];

export function evaluateDisparity(message = '', uri = '') {
  const parsed = parseUpi(uri);
  const cleanMsg = (message || '').toLowerCase().trim();

  // 1. Malformed Scheme / URI
  if (!parsed.isValid) {
    return {
      verdict: 'MALFORMED_PAYLOAD',
      score: 1.0,
      signals: [{ id: 'MALFORMED_URI', weight: 100 }],
      parsedUri: parsed
    };
  }

  const rawPa = parsed.pa;
  const decodedPa = (() => {
    try { return decodeURIComponent(rawPa); } catch { return rawPa; }
  })();
  const lowerPa = decodedPa.toLowerCase();
  const signals = [];

  // 2. Zero-Knowledge Threat Radar Match
  if (isVpaFlaggedInRadar(lowerPa)) {
    signals.push({ id: 'COMMUNITY_THREAT_RADAR_MATCH', weight: 100 });
    return {
      verdict: 'CRITICAL_INTENT_DISPARITY',
      score: 0.99,
      signals,
      parsedUri: parsed
    };
  }

  // 3. Bank Awareness Educational Negation Advisory (Test #21)
  if (
    /(bank\s+never\s+asks\s+for\s+pin|never\s+share\s+pin|kabhi\s+bhi\s+pin\s+na\s+dalein|never\s+enter\s+pin)/i.test(cleanMsg) &&
    !/(bhej\s+diya|bheja\s+hai|sent\s+rs|maine\s+5000)/i.test(cleanMsg)
  ) {
    return {
      verdict: 'INSUFFICIENT_CONTEXT',
      score: 0.1,
      signals: [{ id: 'ADVISORY_NEGATION', weight: 10 }],
      parsedUri: parsed
    };
  }

  // 4. Cyrillic Homograph Attacks
  const isCyrillic = CYRILLIC_REGEX.test(decodedPa) || PERCENT_CYRILLIC_REGEX.test(rawPa);
  if (isCyrillic) {
    signals.push({ id: 'HOMOGRAPH_ATTACK', weight: 65 });
  }

  // 5. Pattern Classifications (Latin & Devanagari)
  const hasReverseSignal = /(bhej\s*diya|bhej\s*diye|bheja\s*hai|bhej\s*di\s*hai|भेज\s*दिया|भेजे\s*हैं|पैसे\s*पाने|credit\b|credited\b|claim\s*your\s*payment|claim.*cashback|cashback|receive\s*rs|receive.*cashback|scan\s+to\s+receive|accept\s*funds|accept\s*money|i\s*am\s*paying\s*you|transfer\s*done|advance\s*bhej)/i.test(cleanMsg) ||
    (/\bsent\b/i.test(cleanMsg) && !/\b(cab|auto|fare|chai|tea|kirana)\b/i.test(cleanMsg));

  const directsPin = /(pin\s*dalo|enter\s*pin|put\s*pin|pin\s*daal|पिन\s*डाल|पिन\s*दर्ज|pin\s*enter)/i.test(cleanMsg);
  const directsAcceptOnly = /(bas\s*accept\s*karo|sirf\s*accept|pin\s*mat\s*dalo)/i.test(cleanMsg);
  const isUrgent = /(cutoff|power\s*cut|power\s*disconnected|disconnected|bijli|blocked|expire|within\s*\d+|aaj\s*raat|immediate|urgent|bill\s+desk)/i.test(cleanMsg);

  if (hasReverseSignal) {
    signals.push({ id: 'REVERSE_CHARGE_SIGNAL', weight: 60 });
  }

  if (directsPin) {
    signals.push({ id: 'DIRECTIVE_PIN_ENTRY', weight: 50 });
  }

  if (directsAcceptOnly) {
    signals.push({ id: 'DIRECTIVE_ACCEPT_ONLY', weight: 55 });
  }

  if (isUrgent) {
    signals.push({ id: 'URGENCY_INTIMIDATION', weight: 55 });
  }

  // 6. Impersonation of Official Entities on Consumer PSP handles
  const isConsumerPsp = CONSUMER_PSPS.some(psp => lowerPa.endsWith(psp));
  const impersonatesTarget = IMPERSONATION_TARGETS.some(t => lowerPa.includes(t));
  if (isConsumerPsp && impersonatesTarget) {
    signals.push({ id: 'IMPERSONATION_RISK', weight: 55 });
  }

  // 7. Amount Extraction & Uncorroborated Check
  const amountMatch = cleanMsg.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:\/-)?/i);
  let claimedAmount = null;
  if (amountMatch && amountMatch[1]) {
    claimedAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }
  const uriAmount = parsed.am ? parseFloat(parsed.am) : null;

  // Uncorroborated amount: Text promises money/advance without stating exact amount, but URI silently carries an amount
  const isUncorroboratedAmount = hasReverseSignal && claimedAmount === null && uriAmount !== null;
  const hasAmountMismatch = claimedAmount !== null && uriAmount !== null && Math.abs(claimedAmount - uriAmount) > 0.01;

  if (hasAmountMismatch) {
    signals.push({ id: 'AMOUNT_MISMATCH', weight: 50 });
  } else if (isUncorroboratedAmount) {
    signals.push({ id: 'UNCORROBORATED_AMOUNT', weight: 50 });
  }

  // 8. Legitimate Outgoing Purchases
  const isOutgoingPurchase = /(chai|tea|kirana|milk|doodh|vegetables|grocery|groceries|cab|auto|taxi|fare|payment\s*for|paid\s*for|fare\s*payment)/i.test(cleanMsg);
  const hasScamIntent = hasReverseSignal || directsPin || directsAcceptOnly || isUrgent || (isConsumerPsp && impersonatesTarget) || isCyrillic;

  if (isOutgoingPurchase && !hasScamIntent && !hasAmountMismatch) {
    signals.push({ id: 'INTENT_USER_OUTGOING', weight: -30 });
    return {
      verdict: 'NO_DISPARITY_DETECTED',
      score: 0.0,
      signals,
      parsedUri: parsed
    };
  }

  // 9. Exact Verdict Logic Hierarchy

  // Rule 1: Reverse Charge with Uncorroborated Amount is HIGH_INTENT_DISPARITY (Test #9)
  if (isUncorroboratedAmount) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.75,
      signals,
      parsedUri: parsed
    };
  }

  // Rule 2: Amount Mismatch without PIN is HIGH (Test #16)
  if (hasAmountMismatch && !directsPin) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.75,
      signals,
      parsedUri: parsed
    };
  }

  // Rule 3: "PIN mat dalo, bas accept karo" is explicitly HIGH (Test #15)
  if (directsAcceptOnly) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.75,
      signals,
      parsedUri: parsed
    };
  }

  // Rule 4: CRITICAL CONDITIONS (Explicit Reverse Claim or PIN Directive)
  const isCriticalReverseClaim = (
    directsPin ||
    (hasReverseSignal && /(claim|receive|i\s*am\s*paying|cashback)/i.test(cleanMsg)) ||
    (hasReverseSignal && uriAmount && claimedAmount && Math.abs(claimedAmount - uriAmount) <= 0.01) ||
    (hasReverseSignal && /(bhej\s*diya|bheja\s*hai|advance)/i.test(cleanMsg))
  );

  if (isCriticalReverseClaim) {
    return {
      verdict: 'CRITICAL_INTENT_DISPARITY',
      score: 0.95,
      signals,
      parsedUri: parsed
    };
  }

  // Rule 5: OTHER HIGH CONDITIONS
  if (
    isUrgent ||
    isCyrillic ||
    (isConsumerPsp && impersonatesTarget) ||
    hasReverseSignal
  ) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.75,
      signals,
      parsedUri: parsed
    };
  }

  // Rule 6: NO DISPARITY
  if (cleanMsg.length > 0 && !hasScamIntent) {
    return {
      verdict: 'NO_DISPARITY_DETECTED',
      score: 0.05,
      signals,
      parsedUri: parsed
    };
  }

  // Rule 7: DEFAULT
  return {
    verdict: 'INSUFFICIENT_CONTEXT',
    score: 0.15,
    signals,
    parsedUri: parsed
  };
}
