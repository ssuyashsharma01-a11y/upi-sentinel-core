export const formatAmount = (amt) => {
  if (amt === null || amt === undefined || isNaN(amt)) return 'Unavailable';
  return `Rs ${Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const validateCommaGrouping = (numStr) => {
  if (!numStr.includes(',')) return true;
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const subparts = integerPart.split(',');
  
  // Western format: 1,000,000
  const isWestern = [1, 2, 3].includes(subparts[0].length) && subparts.slice(1).every(p => p.length === 3);
  
  // Indian format: 1,50,000
  let isIndian = false;
  if (subparts.length >= 2) {
    if (subparts[subparts.length - 1].length === 3 && subparts.slice(1, -1).every(p => p.length === 2) && [1, 2].includes(subparts[0].length)) {
      isIndian = true;
    }
  }
  return isWestern || isIndian;
};

export const parseUpiUri = (uriString) => {
  if (!uriString || typeof uriString !== 'string') {
    return { isValid: false, error: 'Empty or non-string payload' };
  }
  const clean = uriString.trim();
  if (!/^upi:\/\/pay(\?|$)/i.test(clean)) {
    return { isValid: false, error: 'Invalid URI scheme. Must start with upi://pay' };
  }

  try {
    const url = new URL(clean);
    const queryString = url.search.startsWith('?') ? url.search.slice(1) : url.search;
    const items = queryString.split('&').filter(Boolean);
    const keys = items.map(i => i.split('=')[0].toLowerCase());
    if (new Set(keys).size !== keys.length) {
      return { isValid: false, error: 'Conflicting duplicate query parameters detected' };
    }

    const params = new URLSearchParams(url.search);
    const pa = params.get('pa');
    const pn = params.get('pn');
    const amRaw = params.get('am');
    const cu = (params.get('cu') || 'INR').toUpperCase();
    const mode = params.get('mode') || null;

    if (!pa || pa.trim() === '') {
      return { isValid: false, error: 'Missing mandatory VPA (pa) parameter' };
    }
    if (!pa.includes('@') || pa.split('@')[0].length === 0 || pa.split('@')[1].length === 0) {
      return { isValid: false, error: 'Malformed VPA handle format (requires user@bank)' };
    }

    if (cu !== 'INR') {
      return { isValid: false, error: `Unsupported currency: ${cu}. Protocol client strictly enforces INR.` };
    }

    let parsedAm = null;
    if (amRaw !== null && amRaw.trim() !== '') {
      const cleanAm = amRaw.trim();
      if (!/^\d+(\.\d{1,2})?$/.test(cleanAm)) {
        return { isValid: false, error: 'Malformed amount numeric string' };
      }
      parsedAm = Number(cleanAm);
      if (isNaN(parsedAm) || parsedAm <= 0) {
        return { isValid: false, error: 'Payload amount must be strictly greater than zero' };
      }
    }

    return {
      isValid: true,
      pa: pa.trim(),
      pn: pn && pn.trim() !== '' ? pn.trim() : 'Unregistered Payee Label',
      am: parsedAm,
      cu,
      mode
    };
  } catch (err) {
    return { isValid: false, error: 'URI syntax decoding failed' };
  }
};

export const extractSignals = (text, parsedUri) => {
  if (!text || text.trim().length === 0) {
    return { signals: [], extractedAmount: null, hasUrgency: false, urgencyCues: [] };
  }
  const lower = text.toLowerCase().trim();
  const signals = [];

  // Punctuation-safe amount extraction
  let extractedAmount = null;
  const hasNegativeCurrency = /(?:₹|rs\.?|inr)\s*-\s*\d+/i.test(lower) || /-\s*(?:₹|rs\.?|inr)\s*\d+/i.test(lower);
  if (!hasNegativeCurrency) {
    // Regex matches currency tokens with explicit boundary before punctuation
    const amtRegex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)(?!\s*-\s*\d)|(?:\b|^)([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs|inr|\/-)/i;
    const match = lower.match(amtRegex);
    if (match) {
      let rawVal = (match[1] || match[2]).trim();
      // Strip trailing punctuation if regex matched a trailing comma
      rawVal = rawVal.replace(/,+$/, '');
      if (validateCommaGrouping(rawVal)) {
        const parsed = parseFloat(rawVal.replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          extractedAmount = parsed;
        }
      }
    }
  }

  const urgencyPatterns = [
    /\burgent\b/, /\bimmediately\b/, /\bpower disconnected\b/, /\bdisconnected tonight\b/,
    /\bpower cut\b/, /\bpolice complaint\b/, /\baccount blocked\b/, /\bpenalty\b/, /\bchallan\b/
  ];
  const detectedUrgency = urgencyPatterns.filter(p => p.test(lower)).map(p => p.source.replace(/\\b/g, ''));
  const hasUrgency = detectedUrgency.length > 0;

  const hasPinNegation = /\b(pin\s+mat|mat\s+daal|mat\s+dalo|don't\s+enter\s+pin)\b/i.test(lower);

  const pinDirectivePattern = /\b(pin\s*dalo|enter\s*pin|pin\s*daalo|daalo\s*pin)\b/i;
  const hasPinDirective = pinDirectivePattern.test(lower) && !hasPinNegation;
  if (hasPinDirective) {
    signals.push({ id: 'DIRECTIVE_PIN_ENTRY', weight: 45, reason: 'PIN entry demanded on outgoing debit payload' });
  }

  const acceptDirectivePattern = /\b(accept\s*karo|accept\s*karke|credit\s*receive|claim\s*karo|receive\s*karo|scan\s*karke)\b/i;
  const hasAcceptDirective = acceptDirectivePattern.test(lower);
  if (hasAcceptDirective) {
    signals.push({ id: 'DIRECTIVE_ACCEPT_OR_CLAIM', weight: 35, reason: 'Directive prompts victim to accept/claim funds via QR' });
  }

  const counterpartyClaimPatterns = [
    /\b(bhej\s*diya|bhej\s*di\s*hai|bheja\s*hai|bhej\s*diye|i\s*sent\s*you|i\s*have\s*sent)\b/i,
    /\b(i\s*am\s*paying\s*you|paying\s*you|sent\s*to\s*you)\b/i,
    /\b(refund\s*approve|refund\s*approved|credit\s*ho\s*jayenge|credited\s*to\s*your)\b/i
  ];
  const hasCpClaim = counterpartyClaimPatterns.some(p => p.test(lower));
  if (hasCpClaim) {
    signals.push({ id: 'CLAIM_COUNTERPARTY_SENT', weight: 35, reason: 'Sender claims funds were sent/directed to user' });
  }

  const isScamDirectivePresent = hasAcceptDirective || hasPinDirective || hasCpClaim;
  const victimSendPatterns = [
    /\b(paid\s*to|send\s*to\s*driver|bill\s*pay|pay\s*kar\s*raha|payment\s.*sent\s*to)\b/i,
    /\bpaying\b(?!.*you)/i
  ];
  if (!isScamDirectivePresent && victimSendPatterns.some(p => p.test(lower))) {
    signals.push({ id: 'INTENT_USER_OUTGOING', weight: -30, reason: 'User contextual message declares intent to make payment' });
  }

  let hasExactAmount = false;
  let hasAmountMismatch = false;
  if (extractedAmount !== null && parsedUri && parsedUri.am !== null) {
    hasExactAmount = Math.abs(extractedAmount - parsedUri.am) < 0.01;
    hasAmountMismatch = !hasExactAmount;
    if (hasExactAmount) {
      signals.push({ id: 'AMOUNT_EXACT_MATCH', weight: 20, reason: 'Context amount exactly matches outgoing payload amount' });
    } else {
      signals.push({ id: 'AMOUNT_MISMATCH', weight: 15, reason: 'Context amount differs from outgoing payload amount' });
    }
  }

  return { 
    signals, 
    extractedAmount, 
    hasUrgency, 
    urgencyCues: detectedUrgency,
    hasPinDirective,
    hasAcceptDirective,
    hasCpClaim,
    hasExactAmount,
    hasAmountMismatch
  };
};

export const evaluateDisparity = (messageText, upiUri) => {
  const parsedUri = parseUpiUri(upiUri);
  if (!parsedUri.isValid) {
    return {
      verdict: 'MALFORMED_PAYLOAD',
      tone: 'neutral',
      badge: 'Malformed Payload',
      title: 'Invalid UPI Payload Scheme',
      claimText: 'Payload string failed syntax validation.',
      actionText: 'Blocked — Invalid structure rejected before parsing completes.',
      correlationText: 'Unavailable',
      reason: parsedUri.error,
      recommendation: 'Do not initiate this payload. The URI violates basic UPI formatting specifications.',
      hasUrgency: false,
      threatScore: 0,
      signals: [],
      parsedUri: null
    };
  }

  const { 
    signals, 
    extractedAmount, 
    hasUrgency, 
    urgencyCues,
    hasPinDirective,
    hasAcceptDirective,
    hasCpClaim,
    hasExactAmount,
    hasAmountMismatch
  } = extractSignals(messageText, parsedUri);

  const threatScore = signals.reduce((acc, s) => acc + s.weight, 0);
  const isReverseChargeTrap = hasCpClaim || hasAcceptDirective || hasPinDirective;
  const hasUserOutgoing = signals.some(s => s.id === 'INTENT_USER_OUTGOING');

  // CRITICAL: Any reverse-charge scam vector where amount is corroborated with payload
  if (isReverseChargeTrap && hasExactAmount) {
    return {
      verdict: 'CRITICAL_INTENT_DISPARITY',
      tone: 'critical',
      badge: 'Critical Disparity',
      title: 'Reverse-Charge Scam Vector Detected',
      claimText: `Context indicates funds are to be received or claimed (${formatAmount(extractedAmount)}).`,
      actionText: `Payload executes an OUTGOING DEBIT of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
      correlationText: 'Exact Match (Promised incoming sum matches debit payload)',
      reason: 'UPI protocol does not require QR scan or PIN entry to receive money. Authorizing this will debit your account.',
      recommendation: 'Abort transaction immediately. Never input your UPI PIN to claim money or refunds.',
      hasUrgency,
      urgencyCues,
      threatScore,
      signals,
      parsedUri
    };
  }

  // HIGH DISPARITY: Reverse-charge without amount confirmation or uncorroborated
  if (isReverseChargeTrap || threatScore >= 35) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      tone: 'critical',
      badge: 'High Disparity',
      title: 'Suspicious Reverse-Flow Vector',
      claimText: `Communication promises incoming transfer or credit (${formatAmount(extractedAmount)}).`,
      actionText: `Payload requests an outgoing payment of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
      correlationText: 'Discrepant or Uncorroborated Sum',
      reason: 'Reverse-charge keywords detected alongside a direct debit link. Verification required.',
      recommendation: 'Do not enter PIN. Verify if you intended to pay this person or receive funds.',
      hasUrgency,
      urgencyCues,
      threatScore,
      signals,
      parsedUri
    };
  }

  if (hasUserOutgoing && hasAmountMismatch) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      tone: 'critical',
      badge: 'Amount Disparity',
      title: 'Payment Amount Mismatch',
      claimText: `User stated intent to pay ${formatAmount(extractedAmount)}.`,
      actionText: `Payload requests an outgoing payment of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
      correlationText: 'Mismatched Amount',
      reason: 'Payload debit sum does not match the amount discussed in chat context.',
      recommendation: 'Verify why the beneficiary has requested a different amount than discussed.',
      hasUrgency,
      urgencyCues,
      threatScore,
      signals,
      parsedUri
    };
  }

  if (hasUserOutgoing && !isReverseChargeTrap && !hasUrgency) {
    return {
      verdict: 'NO_DISPARITY_DETECTED',
      tone: 'safe',
      badge: 'No Disparity Detected',
      title: 'Intent & Protocol Payload Aligned',
      claimText: `User stated intent to pay ${formatAmount(extractedAmount)}.`,
      actionText: `Payload requests an outgoing payment of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
      correlationText: hasExactAmount ? 'Corroborated Sum' : 'Consistent Direction',
      reason: 'Contextual communication matches the outgoing debit nature of the payload string.',
      recommendation: 'Standard payment caution applies. Verify beneficiary name before entering PIN.',
      hasUrgency: false,
      urgencyCues: [],
      threatScore,
      signals,
      parsedUri
    };
  }

  return {
    verdict: 'INSUFFICIENT_CONTEXT',
    tone: 'caution',
    badge: hasUrgency ? 'Coercion / Urgency Signal' : 'Insufficient Context',
    title: hasUrgency ? 'Urgency Pressure Notice' : 'Indeterminate Context Boundary',
    claimText: messageText.trim() ? (hasUrgency ? `Context contains urgency markers: [${urgencyCues.join(', ')}]` : 'No clear send or receive intent found.') : 'No message context provided.',
    actionText: `Payload requests an outgoing debit of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
    correlationText: 'Unavailable',
    reason: hasUrgency ? 'Urgency pressure detected without conclusive scam pattern. Exercise caution.' : 'System could not establish directional intent against the payload.',
    recommendation: 'Pause and verify beneficiary identity directly inside your official banking application.',
    hasUrgency,
    urgencyCues,
    threatScore,
    signals,
    parsedUri
  };
};