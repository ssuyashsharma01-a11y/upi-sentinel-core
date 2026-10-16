import { isVpaFlaggedInRadar } from '../utils/threatIntel.js';
import { parseUpiUri } from '../utils/upiParser.js';

export function normalizeSecurityText(input = '') {
  if (typeof input !== 'string') return '';
  const zeroWidthRegex = /[\u200B-\u200D\u2060\uFEFF]/g;
  let normalized = input.normalize('NFKC').replace(zeroWidthRegex, '').toLowerCase().trim();
  normalized = normalized.replace(/[\u0966-\u096F]/g, d => String(d.charCodeAt(0) - 0x0966));
  return normalized;
}

export function extractAllAmounts(text) {
  if (!text || typeof text !== 'string') return [];
  const t = normalizeSecurityText(text);
  const re = /(?:\u20b9|\brs\.?|\binr)\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees\b|rs\b|inr\b|\/-)/gi;
  const amounts = [];
  for (const m of t.matchAll(re)) {
    const raw = (m[1] ?? m[2]).replace(/,/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0) {
      amounts.push(num);
    }
  }
  return amounts;
}

const CYRILLIC_REGEX = /[\u0400-\u04FF]/;
const PERCENT_CYRILLIC_REGEX = /%D[0-4]%[89A-F][0-9A-F]/i;

const HIGH_AUTHORITY_IMPERSONATION = [
  /\brbi\b/i, /\brefund\s*desk\b/i, /\belectricity\b/i,
  /\bdiscom\b/i, /\bbsnl\b/i, /\bcustomercare\b/i, /\blottery\b/i, /\bkbc\b/i,
  /\bpolice\b/i, /\bchallan\b/i, /\btraffic\b/i, /\brto\b/i, /\bincome\s*tax\b/i
];

export function evaluateDisparity(contextText = '', uriPayload = '') {
  const parsed = parseUpiUri(uriPayload);

  if (!parsed.isValid) {
    return {
      verdict: 'MALFORMED_PAYLOAD',
      score: 100,
      signals: [{ id: 'MALFORMED_URI', label: parsed.error || 'Invalid UPI Payload' }],
      reasons: [parsed.error || 'Invalid UPI payload or parameter smuggling detected'],
      isSmuggled: Boolean(parsed.isSmuggled),
      parsedPayload: parsed
    };
  }

  const normalized = normalizeSecurityText(contextText);

  if (!normalized) {
    return {
      verdict: 'INSUFFICIENT_CONTEXT',
      score: 10,
      signals: [{ id: 'NO_CONTEXT', label: 'Payment link without conversational context' }],
      reasons: ['No text context provided to evaluate against payment payload'],
      parsedPayload: parsed
    };
  }

  // Pure bank awareness advisory negation
  const isAwarenessNegation = /bank\s+never\s+asks\s+for\s+pin/i.test(normalized);
  if (isAwarenessNegation && !/(bhej|sent|pay\s*karo|pin\s*dalo|accept|claim)/i.test(normalized.replace(/bank\s+never\s+asks\s+for\s+pin/i, ''))) {
    return {
      verdict: 'INSUFFICIENT_CONTEXT',
      score: 10,
      signals: [{ id: 'AWARENESS_NEGATION', label: 'Security advisory text' }],
      reasons: ['Informational bank advisory text detected'],
      parsedPayload: parsed
    };
  }

  const amounts = extractAllAmounts(contextText);
  const claimedAmount = amounts.length > 0 ? amounts[0] : null;
  const payloadAmount = parsed.parsedAmount;

  const signals = [];
  const reasons = [];
  let severityScore = 0;

  // 1. Community Threat Radar Seed Hit
  if (isVpaFlaggedInRadar(parsed.pa)) {
    signals.push({ id: 'COMMUNITY_THREAT_RADAR_MATCH', label: 'Known Malicious VPA' });
    signals.push({ id: 'THREAT_RADAR_HIT', label: 'Known Threat Intelligence Hit' });
    reasons.push(`VPA ${parsed.pa} matches known threat intelligence telemetry`);
    severityScore = Math.max(severityScore, 95);
  }

  // 2. Homoglyph / Cyrillic Spoofing
  if (CYRILLIC_REGEX.test(parsed.pa) || PERCENT_CYRILLIC_REGEX.test(parsed.rawUri) || /%[0-9a-f]{2}/i.test(parsed.pa)) {
    signals.push({ id: 'HOMOGLYPH_VPA', label: 'Cyrillic Homoglyph Lookalike' });
    reasons.push('Homoglyph attack: Non-Latin lookalike characters detected in VPA address');
    severityScore = Math.max(severityScore, 65);
  }

  // 3. High Authority Impersonation Check (RBI, Refund Desk on personal/wallet VPAs like @paytm, @ybl)
  const combinedIdent = `${parsed.pa} ${parsed.pn || ''}`;
  const isHighAuthority = HIGH_AUTHORITY_IMPERSONATION.some(pattern => pattern.test(combinedIdent));
  if (isHighAuthority && !/@(rbi\.org\.in|gov\.in)$/i.test(parsed.pa)) {
    signals.push({ id: 'IMPERSONATION_RISK', label: 'Institutional Impersonation' });
    reasons.push('Payee claims regulatory or institutional authority on an unverified handle');
    severityScore = Math.max(severityScore, 65);
  }

  // 4. User Genuine Debit Intent Detection (Excludes when high authority impersonation is caught)
  const creditClaims = /\b(bhej\s*diya|bhej\s*di\s*hai|bheja\s*hai|bhej\s*diye|i\s*sent\s*you|i\s*have\s*sent|i\s*am\s*paying\s*you|payment.*received|scan\s*to\s*(?:receive|claim)|refund\s*(?:approve|milega)|credit\s*ho\s*jayenge|credited|cashback|\u0930\u093f\u092b\u0902\u0921|\u092a\u0948\u0938\u0947\s*\u092a\u093e\u0928\u0947)\b/i.test(normalized);
  const acceptDirective = /\b(accept\s*karo|accept\s*karke|claim\s*your\s*payment|receive\s*cashback)\b/i.test(normalized);

  const isUserSending = /\b(paying\s+(?:bill|cab|chai|mess)|paid\s*to|send\s*to\s*driver)\b/i.test(normalized) && !creditClaims;

  // 5. PIN Directives vs PIN Negation
  const pinNegation = /\b(pin\s+mat|mat\s+daal|mat\s+dalo|don't\s+enter\s+pin|\u092a\u093f\u0928\s+\u092e\u0924\s+\u0921\u093e\u0932)/i.test(normalized);
  const pinDirective = (/\b(pin\s*(?:dalo|enter|daalo|daalna|daaliye|dalen)|enter\s*pin|daalo\s*pin)\b/i.test(normalized) ||
    /[\u092a\u093f\u0928\s]+[\u0921\u093e\u0932\u0947\u0902\u0930\u094d\u091c]+/i.test(normalized)) && !pinNegation;

  const urgencyPatterns = [
    /\burgent\b/i, /\bimmediately\b/i, /\bpower\s*disconnected\b/i,
    /\bdisconnected\s*tonight\b/i, /\bpower\s*cut\b/i, /\bpolice\b/i, /\bbijli\s*kat\b/i
  ];
  const hasUrgency = urgencyPatterns.some(p => p.test(normalized));

  // 6. Reverse Charge and Directive Scoring
  if (pinNegation && (creditClaims || acceptDirective)) {
    signals.push({ id: 'CONFUSION_TRAP', label: 'Contradictory PIN/Accept Advisory' });
    reasons.push('Message contradicts standard banking advice regarding PIN entry');
    severityScore = Math.max(severityScore, 65);
  } else if (creditClaims && !isUserSending) {
    if (payloadAmount && payloadAmount > 0 && claimedAmount !== null) {
      signals.push({ id: 'REVERSE_CHARGE_TRAP', label: 'Reverse-Charge Intent Inversion' });
      reasons.push(`Context claims credit/payment sent, but URI initiates a debit of ₹${payloadAmount}`);
      severityScore = Math.max(severityScore, 95);
    } else {
      signals.push({ id: 'UNCORROBORATED_CREDIT', label: 'Uncorroborated Credit Promise' });
      reasons.push('Context promises credit or refund without verified amount corroboration in text');
      severityScore = Math.max(severityScore, 65);
    }
  } else if (pinDirective) {
    signals.push({ id: 'PIN_DECEPTION', label: 'Deceptive PIN Entry Directive' });
    reasons.push('PIN directive detected: User instructed to enter secret PIN');
    severityScore = Math.max(severityScore, 95);
  }

  if (acceptDirective && !isUserSending && !pinNegation && severityScore < 65) {
    signals.push({ id: 'ACCEPT_DIRECTIVE', label: 'Deceptive Accept Action' });
    reasons.push('User instructed to accept incoming payment via payment URI');
    severityScore = Math.max(severityScore, 65);
  }

  // 7. Amount Discrepancy
  if (claimedAmount && payloadAmount && Math.abs(claimedAmount - payloadAmount) > 0.01) {
    signals.push({ id: 'AMOUNT_MISMATCH', label: 'Contextual Amount Discrepancy' });
    reasons.push(`Message mentions ₹${claimedAmount}, but transaction payload requests ₹${payloadAmount}`);
    severityScore = Math.max(severityScore, 65);
  }

  // 8. Urgency
  if (hasUrgency && !isUserSending) {
    signals.push({ id: 'URGENCY_INTIMIDATION', label: 'Urgency / Coercive Intimidation' });
    reasons.push('Urgent pressure keywords detected');
    severityScore = Math.max(severityScore, 65);
  }

  let verdict = 'NO_DISPARITY_DETECTED';
  if (severityScore >= 80) {
    verdict = 'CRITICAL_INTENT_DISPARITY';
  } else if (severityScore >= 45) {
    verdict = 'HIGH_INTENT_DISPARITY';
  }

  return {
    verdict,
    score: severityScore,
    signals,
    reasons,
    parsedPayload: parsed
  };
}