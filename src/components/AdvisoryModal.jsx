import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Volume2, 
  Copy, 
  Check 
} from 'lucide-react';

export default function AdvisoryModal({ analysis, onReset, lang = 'hi' }) {
  const [copied, setCopied] = useState(false);
  const [canProceed, setCanProceed] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isCritical = analysis?.verdict === 'CRITICAL_INTENT_DISPARITY';
  const isHigh = analysis?.verdict === 'HIGH_INTENT_DISPARITY';
  const isDanger = isCritical || isHigh;

  useEffect(() => {
    setCanProceed(false);
    setCountdown(5);
    if (!isDanger) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanProceed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [analysis?.verdict]);

  const handleCopyVpa = () => {
    if (analysis?.parsedUri?.pa) {
      navigator.clipboard.writeText(analysis.parsedUri.pa);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpeakVerdict = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const textToRead = lang === 'hi' 
      ? `${analysis?.oneLiner?.hi || 'सावधान'}. ${analysis?.actionText || ''}`
      : `${analysis?.oneLiner?.en || 'Caution'}. ${analysis?.actionText || ''}`;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  if (!analysis) return null;

  return (
    <div className="space-y-4">
      {/* 1. Payee Verification Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>भुगतान विवरण (Payment Snapshot)</span>
          {analysis?.parsedUri?.am && (
            <span className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-0.5 rounded-full">
              ₹{analysis.parsedUri.am}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-0.5">Payee Name (प्राप्तकर्ता)</span>
            <span className="font-bold text-slate-800 text-sm break-words">
              {analysis?.parsedUri?.pn || 'अज्ञात (Unknown)'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
            <div className="min-w-0 mr-2">
              <span className="text-slate-400 block text-[11px] mb-0.5">UPI ID (VPA)</span>
              <span className="font-mono font-semibold text-slate-700 text-xs truncate block">
                {analysis?.parsedUri?.pa || 'N/A'}
              </span>
            </div>
            {analysis?.parsedUri?.pa && (
              <button
                type="button"
                onClick={handleCopyVpa}
                title="Copy payee ID (VPA)"
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. High-Contrast Warning Card */}
      <div className={`rounded-3xl p-6 sm:p-7 shadow-lg border transition-all ${
        isDanger 
          ? 'bg-[#881337] border-rose-900 text-white' 
          : analysis.tone === 'caution'
            ? 'bg-amber-950 border-amber-900 text-amber-50'
            : 'bg-emerald-950 border-emerald-900 text-emerald-50'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            {isDanger ? (
              <ShieldAlert className="w-8 h-8 text-rose-300 shrink-0" />
            ) : analysis.tone === 'caution' ? (
              <AlertTriangle className="w-8 h-8 text-amber-300 shrink-0" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-emerald-300 shrink-0" />
            )}
            <div>
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-white mb-1">
                {analysis.badge}
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {lang === 'hi' 
                  ? (isDanger ? 'धोखाधड़ी का खतरा!' : analysis.title)
                  : analysis.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSpeakVerdict}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer transition-colors shrink-0"
            title="बोलकर सुनें"
          >
            <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse text-amber-300' : ''}`} />
            <span className="hidden sm:inline">बोलकर सुनें</span>
          </button>
        </div>

        <div className="my-5 p-4 rounded-2xl bg-black/30 border border-white/10 space-y-1.5">
          <div className="text-lg sm:text-xl font-bold text-white leading-snug">
            {analysis.oneLiner?.[lang] || analysis.oneLiner?.en}
          </div>
          {analysis.claimText && (
            <div className="text-xs text-rose-200/90 line-through font-mono">
              दावा: "{analysis.claimText}"
            </div>
          )}
          <div className="text-xs sm:text-sm text-amber-200 font-semibold pt-1">
            ⚠️ {analysis.actionText}
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-rose-100 sm:text-sm">
          <p><span className="font-bold text-white">कारण:</span> {analysis.reason}</p>
          <p><span className="font-bold text-white">सुझाव:</span> {analysis.recommendation}</p>
        </div>

        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>लेनदेन रद्द करें (सुरक्षित रहें)</span>
          </button>

          {isDanger && (
            <div className="text-center w-full sm:w-auto">
              {canProceed ? (
                <a
                  href={analysis.parsedUri?.rawUri || '#'}
                  className="text-xs text-rose-200 hover:text-white underline font-medium p-2 block"
                >
                  मैं जोखिम समझता हूँ, आगे बढ़ें
                </a>
              ) : (
                <span className="text-[11px] text-rose-300/80 font-mono block p-2">
                  आगे बढ़ने का विकल्प {countdown}s में खुलेगा...
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
