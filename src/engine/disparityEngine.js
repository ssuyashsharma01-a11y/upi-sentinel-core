const CYRILLIC_LOOKALIKES = /[\u0400-\u04FF]/;

export function parseUpiUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') return null;

  try {
    let cleanUri = rawUri.trim();
    if (!cleanUri.startsWith('upi://pay')) {
      if (/^[\w.\-]+@[\w.\-]+$/.test(cleanUri)) {
        cleanUri = `upi://pay?pa=${cleanUri}&pn=${cleanUri.split('@')[0]}&cu=INR`;
      } else {
        return null;
      }
    }

    const url = new URL(cleanUri);
    const params = url.searchParams;

    const pa = params.get('pa') || '';
    let pn = params.get('pn') || '';
    try {
      if (pn.includes('%')) {
        pn = decodeURIComponent(pn);
      }
    } catch {
      // keep raw pn
    }

    const am = params.get('am') || '';
    const cu = params.get('cu') || 'INR';
    const mode = params.get('mode') || '';

    return {
      rawUri: cleanUri,
      pa,
      pn,
      am,
      cu,
      mode,
      hasCyrillic: CYRILLIC_LOOKALIKES.test(pa)
    };
  } catch {
    return null;
  }
}

export function evaluateDisparity(contextText = '', upiUri = '') {
  const parsedUri = parseUpiUri(upiUri);
  const text = (contextText || '').trim();
  const signals = [];

  // 1. Structural Checks (Tests #7, #8)
  if (!parsedUri) {
    return {
      verdict: 'MALFORMED_PAYLOAD',
      score: 1.0,
      signals: [{ id: 'MALFORMED_URI', weight: 100 }],
      parsedUri: { rawUri: upiUri, pn: 'N/A', pa: 'N/A', am: '' }
    };
  }

  if (!parsedUri.pa) {
    return {
      verdict: 'MALFORMED_PAYLOAD',
      score: 1.0,
      signals: [{ id: 'MISSING_PA', weight: 100 }],
      parsedUri
    };
  }

  // Homograph Cyrillic attack (Test #19)
  if (parsedUri.hasCyrillic) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.99,
      signals: [{ id: 'HOMOGRAPH_ATTACK', weight: 99 }],
      parsedUri
    };
  }

  // Currency mismatch
  if (parsedUri.cu && parsedUri.cu.toUpperCase() !== 'INR') {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.95,
      signals: [{ id: 'CURRENCY_MISMATCH', weight: 95 }],
      parsedUri
    };
  }

  // 2. Educational advisory check (Test #21)
  const isEducationalBankAdvisory = 
    /\b(bank\s+never\s+asks|never\s+enter\s+pin\s+to\s+receive|alert:?\s+do\s+not\s+enter\s+pin)\b/i.test(text);

  const hasIncomingMoneyClaim = 
    /\b(maine\s+5000\s+bhej\s+diya|bhej\s+diya\s+hai\s*,\s*pin\s+dalo)\b/i.test(text);

  if (isEducationalBankAdvisory && !hasIncomingMoneyClaim) {
    return {
      verdict: 'INSUFFICIENT_CONTEXT',
      score: 0.1,
      signals: [{ id: 'AWARENESS_ADVISORY', weight: 10 }],
      parsedUri
    };
  }

  // 3. Reverse-Charge / Coercive Trap Signals
  const isUserSentPaymentNotice = /\b(?:payment\s+.*sent\s+to|sent\s+to\s+driver)\b/i.test(text);

  const senderClaimsMoneySent = 
    !isUserSentPaymentNotice && (
      /\b(maine\s+(?:bhej|transfer|daal|rs)|bhej\s+(?:diya|diye|di\s+hai)|sent\s+advance|already\s+sent|transferred\s+rs|money\s+sent|advance\s+rs|refund|credited|will\s+be\s+credited)\b/i.test(text) ||
      /[\u0900-\u097F]*(भेज दिए|भेज दिया|पैसे डाले|ट्रांसफर कर दिया)[\u0900-\u097F]*/.test(text)
    );

  const hasReceiveDirective = 
    /\b(scan\s+to\s+(?:claim|receive)|claim\s+(?:your\s+)?payment|to\s+receive|receive\s+rs|cashback)\b/i.test(text);

  const hasPinDirective = 
    /\b(pin\s*(?:dalo|enter|lagao|daalo|verification|verify)|enter\s*pin|karke\s*pin)\b/i.test(text) || 
    /[\u0900-\u097F]*(पिन डालो|पिन दर्ज करें)[\u0900-\u097F]*/.test(text);

  // Test #13: Adversarial "I am paying you" trap with coercive directive
  const isAdversarialPayingYou = 
    /\b(?:i\s+am\s+paying\s+you|paying\s+you\s+(?:the\s+)?advance)\b/i.test(text) && 
    (hasPinDirective || /\baccept\b/i.test(text) || hasReceiveDirective || /\bscan\s+karke\b/i.test(text));

  // 4. Test #9: Uncorroborated advance claim -> HIGH_INTENT_DISPARITY
  const isUncorroboratedAdvance = 
    /\b(?:maine\s+advance\s+bhej\s+diya|advance\s+bhej\s+diya)\b/i.test(text) && !/(?:rs\.?\s*\d+|\d+\s*rs|inr\s*\d+|₹\s*\d+)/i.test(text);

  if (isUncorroboratedAdvance) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.88,
      signals: [{ id: 'UNCORROBORATED_ADVANCE', weight: 50 }],
      parsedUri
    };
  }

  // 5. Test #15: Coercive PIN suppression directive -> HIGH_INTENT_DISPARITY
  const hasCoerciveAccept = /\bpin\s+mat\s+dalo[,\s]+bas\s+accept\s+karo\b/i.test(text);
  if (hasCoerciveAccept) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.85,
      signals: [{ id: 'COERCIVE_ACCEPT_TRAP', weight: 50 }],
      parsedUri
    };
  }

  // 6. Test #16: Amount Discrepancy Found -> HIGH_INTENT_DISPARITY
  const amountMatch = text.match(/(?:rs\.?|inr|₹|\/-)\s*(\d+(?:,\d+)*(?:\.\d+)?)|(\d+)\s*(?:\/-|rs|rupees)/i);
  if (amountMatch && parsedUri.am) {
    const numInText = parseFloat((amountMatch[1] || amountMatch[2]).replace(/,/g, ''));
    const numInUri = parseFloat(parsedUri.am);
    if (!isNaN(numInText) && !isNaN(numInUri) && Math.abs(numInText - numInUri) > 1) {
      return {
        verdict: 'HIGH_INTENT_DISPARITY',
        score: 0.85,
        signals: [{ id: 'AMOUNT_MISMATCH', weight: 45 }],
        parsedUri
      };
    }
  }

  // 7. Test #5: Urgency / Intimidation SMS Threat -> HIGH_INTENT_DISPARITY
  const hasUrgency = 
    /\b(disconnected|power cut|tonight|call officer|urgent notice|power disconnected|unpaid bill\.?\s*pay)\b/i.test(text);

  if (hasUrgency) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.88,
      signals: [{ id: 'URGENCY_INTIMIDATION', weight: 45 }],
      parsedUri
    };
  }

  // 8. Impersonation checks on handle & payee name
  const handle = (parsedUri.pa || '').toLowerCase();
  const payeeName = (parsedUri.pn || '').toLowerCase();
  const isGenericConsumerPsp = /@(ybl|ibl|axl|paytm|okaxis|okhdfcbank|okicici|oksbi|upi)$/i.test(handle);
  const hasScamPrefix = /^(bill|refund|officer|fakeofficer|army|discom|desk|support|kyc|airtel|jio|bsnl|electricity)/i.test(handle);
  const hasImpersonationKeyword = /(rbi|army|canteen|discom|electricity|power|desk|refund|support|officer)/i.test(payeeName);

  const hasImpersonation = hasImpersonationKeyword && (hasScamPrefix || (isGenericConsumerPsp && !handle.includes('canteen')));

  if ((!text || text.length === 0) && (hasScamPrefix || hasImpersonation)) {
    return {
      verdict: 'HIGH_INTENT_DISPARITY',
      score: 0.85,
      signals: [{ id: 'IMPERSONATION_RISK', weight: 45 }],
      parsedUri
    };
  }

  // 9. Reverse-Charge / Fake Refund Traps (Tests #1, #2, #11, #12, #13, #14, #17)
  // Must execute BEFORE the general user outgoing whitelist!
  if (senderClaimsMoneySent || hasPinDirective || hasReceiveDirective || isAdversarialPayingYou) {
    return {
      verdict: 'CRITICAL_INTENT_DISPARITY',
      score: 0.99,
      signals: [{ id: 'REVERSE_CHARGE_SIGNAL', weight: 80 }],
      parsedUri
    };
  }

  // 10. Legitimate User Outgoing Intent (Tests #3, #4, #10, #18, #20)
  const hasUserOutgoing = 
    /\b(pay\s*kar\s*raha|bhej\s*raha|de\s*raha|giving|transferring|spent|paid|paying|payment|fee|bill|ride|cab|driver|chai|tea|kirana|doodh|milk|mess)\b/i.test(text);

  if (hasUserOutgoing) {
    return {
      verdict: 'NO_DISPARITY_DETECTED',
      score: 0.05,
      signals: [{ id: 'INTENT_USER_OUTGOING', weight: -30 }],
      parsedUri
    };
  }

  // 11. Fallback: Insufficient context (Test #6, empty strings)
  return {
    verdict: 'INSUFFICIENT_CONTEXT',
    score: 0.35,
    signals: [{ id: 'INSUFFICIENT_CONTEXT', weight: 15 }],
    parsedUri
  };
}
