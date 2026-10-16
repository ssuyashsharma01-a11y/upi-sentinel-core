import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { analyzeReceiptText } from '../engine/receiptValidator.js';
import { ShieldAlert, ShieldCheck, UploadCloud, FileText } from 'lucide-react';

export default function ReceiptScanner() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setProgress(10);
    setResult(null);

    try {
      const worker = await createWorker('eng');
      setProgress(40);

      const ret = await worker.recognize(file);
      setProgress(85);
      await worker.terminate();

      const analysis = analyzeReceiptText(ret.data.text);
      setResult({
        ...analysis,
        rawText: ret.data.text
      });
    } catch (err) {
      console.error('OCR processing error:', err);
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100 max-w-xl mx-auto my-6">
      <div className="flex items-center space-x-3 mb-4">
        <FileText className="w-6 h-6 text-emerald-400" />
        <h2 className="text-xl font-bold tracking-tight">Fake Payment Slip & OCR Forensics</h2>
      </div>
      <p className="text-sm text-slate-400 mb-6">
        Scammer ne screenshot bheja hai? Upload karo — on-device OCR UTR format, typography aur bank signatures verify karega bina server bheje.
      </p>

      <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/50">
        <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
        <span className="text-sm font-semibold">Upload Payment Screenshot</span>
        <span className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP (Client-Side WASM)</span>
        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </label>

      {loading && (
        <div className="mt-6">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Analyzing image on-device...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {preview && !loading && (
        <div className="mt-4 flex justify-center">
          <img src={preview} alt="Receipt preview" className="max-h-48 rounded-lg border border-slate-800 object-contain" />
        </div>
      )}

      {result && (
        <div className={`mt-6 p-4 rounded-xl border ${
          result.verdict === 'SUSPICIOUS_RECEIPT_ALERT'
            ? 'bg-red-950/40 border-red-800/80 text-red-200'
            : result.verdict === 'ANOMALOUS_RECEIPT_FLAG'
            ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
            : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
        }`}>
          <div className="flex items-center space-x-2 font-bold text-lg mb-2">
            {result.verdict === 'RECEIPT_VALID' ? (
              <>
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <span>Legitimate Looking Receipt</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-6 h-6 text-red-400" />
                <span>{result.verdict === 'SUSPICIOUS_RECEIPT_ALERT' ? 'Warning: High Suspicion of Fake Slip!' : 'Caution: Anomalous Receipt Details'}</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono my-3 bg-black/30 p-3 rounded-lg">
            <div>UTR Ref: <span className="font-bold text-slate-200">{result.detectedUtr || 'Not Found'}</span></div>
            <div>Amount: <span className="font-bold text-slate-200">{result.detectedAmount ? `₹${result.detectedAmount}` : 'Unverified'}</span></div>
          </div>

          {result.signals.length > 0 && (
            <div className="mt-3">
              <span className="text-xs font-semibold uppercase tracking-wider block mb-1">Detected Risk Indicators:</span>
              <ul className="text-xs list-disc pl-5 space-y-1">
                {result.signals.map((sig, idx) => (
                  <li key={idx}><strong>{sig.id}:</strong> {sig.detail || 'Disparity triggered'}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
