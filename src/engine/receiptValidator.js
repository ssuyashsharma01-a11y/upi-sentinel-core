/**
 * Receipt & Payment Screenshot Forensics Engine
 * Runs purely on-device using OCR output.
 */

const UTR_REGEX = /\b(\d{12})\b/;

export function analyzeReceiptText(rawOcrText = '', currentTimestamp = Date.now()) {
  const text = (rawOcrText || '').toLowerCase();
  const signals = [];
  let score = 0;

  // 1. UTR / Reference ID Check
  const utrMatch = rawOcrText.match(UTR_REGEX);
  let detectedUtr = null;

  if (utrMatch) {
    detectedUtr = utrMatch[1];
    if (/^(\d)\1{11}$/.test(detectedUtr) || detectedUtr === '123456789012') {
      signals.push({ id: 'FAKE_MOCK_UTR_SEQUENCE', weight: 80, detail: detectedUtr });
      score += 80;
    }
  } else {
    signals.push({ id: 'MISSING_STANDARD_UTR', weight: 65, detail: 'No 12-digit UTR found' });
    score += 65;
  }

  // 2. Amount Extraction
  const amountMatch = rawOcrText.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                      rawOcrText.match(/\b([\d,]+\.\d{2})\b/);
  
  let detectedAmount = null;
  if (amountMatch) {
    detectedAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
  } else {
    signals.push({ id: 'AMBIGUOUS_RECEIPT_AMOUNT', weight: 35, detail: 'Amount not clearly parsed' });
    score += 35;
  }

  // 3. Fake Generator Missing Bank Masks
  const hasSuccessBanner = /(successful|paid successfully|payment received|transfer successful)/i.test(text);
  const hasAccountMask = /(xx\d{4}|\*{4}\d{4}|a\/c\s*no|bank)/i.test(text);

  if (hasSuccessBanner && !hasAccountMask) {
    signals.push({ id: 'SPOOF_APP_MISSING_ACCOUNT_MASK', weight: 50, detail: 'Lacks masked bank account number' });
    score += 50;
  }

  // 4. Timestamp Sanity Check
  const dateMatch = text.match(/(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})/i) || text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    try {
      const parsedDate = new Date(dateMatch[0]);
      if (parsedDate.getTime() > currentTimestamp + 86400000) {
        signals.push({ id: 'FUTURISTIC_RECEIPT_TIMESTAMP', weight: 90, detail: dateMatch[0] });
        score += 90;
      }
    } catch {}
  }

  // Verdict Resolution
  let verdict = 'RECEIPT_VALID';
  if (score >= 70) {
    verdict = 'SUSPICIOUS_RECEIPT_ALERT';
  } else if (score >= 40) {
    verdict = 'ANOMALOUS_RECEIPT_FLAG';
  }

  return {
    verdict,
    riskScore: Math.min(1.0, score / 100),
    detectedUtr,
    detectedAmount,
    signals,
    rawLength: rawOcrText.length
  };
}
