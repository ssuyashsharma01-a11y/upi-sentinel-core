import { describe, it, expect } from 'vitest';
import { analyzeReceiptText } from '../src/engine/receiptValidator.js';

describe('Receipt Forensics Engine Tests', () => {
  it('Flags mock fake UTR sequence as critical alert', () => {
    const fakeSlipText = `
      Paid Successfully to Suresh Store
      ₹5,000
      UPI Ref ID: 111111111111
      16 Oct 2026
    `;
    const res = analyzeReceiptText(fakeSlipText);
    expect(res.verdict).toBe('SUSPICIOUS_RECEIPT_ALERT');
    expect(res.signals.some(s => s.id === 'FAKE_MOCK_UTR_SEQUENCE')).toBe(true);
  });

  it('Catches fake slip generator missing masked bank account', () => {
    const generatorText = `
      Payment Received ₹2,500
      Transfer Successful
    `;
    const res = analyzeReceiptText(generatorText);
    expect(res.signals.some(s => s.id === 'MISSING_STANDARD_UTR')).toBe(true);
    expect(res.signals.some(s => s.id === 'SPOOF_APP_MISSING_ACCOUNT_MASK')).toBe(true);
  });

  it('Validates legitimate receipt with proper UTR and account masking', () => {
    const legitText = `
      Paid to Gupta Kirana Store
      ₹450.00
      UPI Transaction ID: 428910485912
      Debited from Bank Account **4092
      16 Oct 2026, 03:15 PM
    `;
    const res = analyzeReceiptText(legitText);
    expect(res.verdict).toBe('RECEIPT_VALID');
    expect(res.detectedUtr).toBe('428910485912');
    expect(res.detectedAmount).toBe(450);
  });
});
