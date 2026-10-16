import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  HelpCircle,
  Volume2, 
  PhoneCall, 
  QrCode, 
  ArrowRight, 
  Globe, 
  RefreshCw, 
  ExternalLink, 
  UploadCloud, 
  FileText, 
  Lock, 
  CheckCircle2, 
  Share2, 
  Copy, 
  WifiOff, 
  BookOpen, 
  ShoppingBag, 
  Coins, 
  Zap,
  ClipboardPaste,
  X,
  UserCheck,
  Radio,
  Check
} from 'lucide-react';
import { evaluateDisparity } from './engine/disparityEngine.js';
import { extractSharedPayload } from './utils/ingestion.js';
import { playVoiceAdvisory } from './utils/speech.js';
import { generateZkScamSignature } from './utils/zkReport.js';
import { DEMO_PRESETS } from './data/presets.js';
import { VERDICT_I18N, SIGNAL_I18N } from './i18n/verdicts.js';
import { SUPPORTED_LANGUAGES, DEFAULT_LANG } from './i18n/languages.js';

const QrScanner = lazy(() => import('./components/QrScanner.jsx'));
const ReceiptScanner = lazy(() => import('./components/ReceiptScanner.jsx'));
const VoiceVerifier = lazy(() => import('./components/VoiceVerifier.jsx'));
const ScamDojo = lazy(() => import('./components/ScamDojo.jsx'));

const SCAM_ARCHIVES = [
  {
    title: { en: '1. OLX Army / Reverse Charge Trap', hi: '1. OLX आर्मी / रिवर्स-चार्ज जाल' },
    victim: {
      en: 'Buyer claims they transferred advance money and sends a QR saying "Scan and enter PIN to accept funds".',
      hi: 'सामने वाला एडवांस भेजने का दावा करके क्यूआर भेजता है कि "पैसे पाने के लिए स्कैन करके पिन डालो"।'
    },
    rule: {
      en: 'You NEVER need a UPI PIN to receive money. PIN is strictly used to debit your account.',
      hi: 'पैसे प्राप्त करने के लिए कभी पिन नहीं लगता। पिन डालने से हमेशा आपके खाते से पैसे कटते हैं।'
    }
  },
  {
    title: { en: '2. Electricity Disconnection Urgent Threat', hi: '2. बिजली कटने की धमकी वाला मैसेज' },
    victim: {
      en: 'SMS claims power will be disconnected at 9:30 PM due to unpaid bill; demands instant bill desk payment.',
      hi: 'मैसेज आता है कि आज रात बिजली काट दी जाएगी, तुरंत बिल का भुगतान दिए गए लिंक पर करें।'
    },
    rule: {
      en: 'Discoms never collect arrears via personal SMS UPI links. Pay only on the official state portal or app.',
      hi: 'बिजली कंपनियां कभी व्यक्तिगत SMS पर UPI लिंक नहीं भेजतीं। केवल आधिकारिक पोर्टल या ऐप से भरें।'
    }
  },
  {
    title: { en: '3. Fake Search Engine Customer Care / Refund', hi: '3. गूगल सर्च से मिला फर्जी कस्टमर केयर / रिफंड' },
    victim: {
      en: 'Fake support number sends a refund link asking to authorize ₹1 to verify your bank.',
      hi: 'फर्जी सपोर्ट नंबर रिफंड के नाम पर ₹1 का लिंक भेजकर खाते से पूरी रकम खींच लेता है।'
    },
    rule: {
      en: 'Legitimate refunds are directly credited via IMPS/NEFT; no link authorization required.',
      hi: 'असली रिफंड सीधे आपके खाते में क्रेडिट होता है, उसके लिए किसी लिंक को ऑथराइज नहीं करना पड़ता।'
    }
  },
  {
    title: { en: '4. Telegram Part-Time Like/Review Scam', hi: '4. पार्ट-टाइम टास्क / गूगल रिव्यू स्कैम' },
    victim: {
      en: 'Initial tasks pay ₹150; victim is then lured into "prepaid merchant tasks" requiring large UPI deposits.',
      hi: 'शुरुआत में ₹100-200 देकर विश्वास जीतते हैं, फिर बड़े "प्रीपेड टास्क" के नाम पर लाखों रुपये UPI करवाते हैं।'
    },
    rule: {
      en: 'Any scheme asking for money to release earned profits is 100% fraudulent.',
      hi: 'कमाई निकालने के लिए पहले पैसे जमा करने को कहने वाली हर स्कीम 100% फ्रॉड होती है।'
    }
  },
  {
    title: { en: '5. Fastag / SIM KYC Expiry Warning', hi: '5. फास्टैग / सिम कार्ड केवाईसी एक्सपायरी' },
    victim: {
      en: 'Fake urgency stating SIM card or Fastag will be blocked within 24 hours without immediate UPI charge.',
      hi: 'सिम या फास्टैग ब्लॉक होने की फर्जी चेतावनी देकर ₹10 का अपडेट लिंक भेजते हैं।'
    },
    rule: {
      en: 'KYC updates never occur over third-party payment requests.',
      hi: 'केवाईसी प्रक्रिया कभी भी किसी अनधिकृत पेमेंट लिंक के जरिए नहीं की जाती।'
    }
  }
];

export default function App() {
  const [papaMode, setPapaMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('upi_sentinel_papa_mode') === 'true';
    }
    return false;
  });

  const [lang, setLang] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('upi_sentinel_lang');
      if (saved) return saved;
      const nav = navigator.language?.slice(0, 2);
      if (SUPPORTED_LANGUAGES.some((l) => l.code === nav)) return nav;
    }
    return DEFAULT_LANG;
  });

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [message, setMessage] = useState('');
  const [uri, setUri] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [canProceed, setCanProceed] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeTab, setActiveTab] = useState('scan');
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedZk, setCopiedZk] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [fileError, setFileError] = useState('');
  const [clipboardCandidate, setClipboardCandidate] = useState('');

  const fileInputRef = useRef(null);

  const switchLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('upi_sentinel_lang', newLang);
    setShowLangPicker(false);
  };

  // Pre-warm SpeechSynthesis voices to eliminate first-tap mobile lag
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        // Ignored
      }
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    if (papaMode) {
      document.documentElement.classList.add('papa-mode');
    } else {
      document.documentElement.classList.remove('papa-mode');
    }
    localStorage.setItem('upi_sentinel_papa_mode', papaMode ? 'true' : 'false');
  }, [papaMode]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        if (!navigator.clipboard?.readText) return;
        const text = await navigator.clipboard.readText();
        const trimmed = (text || '').trim();
        if (
          trimmed &&
          trimmed !== uri &&
          (trimmed.startsWith('upi://pay') || /^[\w.\-]+@[\w.\-]+$/.test(trimmed))
        ) {
          setClipboardCandidate(trimmed);
        }
      } catch {
        // Ignored
      }
    };

    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, [uri]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      applyPreset(DEMO_PRESETS[0]);
      return;
    }

    const { rawUri, rawContext } = extractSharedPayload(params);
    if (rawUri || rawContext) {
      const activeUri = rawUri || '';
      const activeMsg = rawContext || '';
      setMessage(activeMsg);
      setUri(activeUri);

      const res = evaluateDisparity(activeMsg, activeUri);
      setAnalysis(res);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const isDanger = analysis?.verdict === 'CRITICAL_INTENT_DISPARITY' || analysis?.verdict === 'HIGH_INTENT_DISPARITY';
  const isCaution = analysis?.verdict === 'INSUFFICIENT_CONTEXT';
  const isSafe = analysis?.verdict === 'NO_DISPARITY_DETECTED';
  const isMalformed = analysis?.verdict === 'MALFORMED_PAYLOAD';

  const isStandaloneRetailScan = isCaution && (!message || message.trim().length === 0);

  useEffect(() => {
    setCanProceed(false);
    const timerDuration = isDanger ? 5 : (isCaution && !isStandaloneRetailScan ? 2 : 0);
    setCountdown(timerDuration);

    if (timerDuration > 0) {
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(isDanger ? [120, 60, 120] : [80]);
      }

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
    } else {
      setCanProceed(true);
    }
  }, [analysis, isDanger, isCaution, isStandaloneRetailScan]);

  const verdictMeta = analysis ? (VERDICT_I18N[analysis.verdict] || VERDICT_I18N.INSUFFICIENT_CONTEXT) : null;
  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
  const payeeDisplay = analysis?.parsedUri?.pn || analysis?.parsedUri?.pa || (lang === 'en' ? 'Payee' : 'प्राप्तकर्ता');
  const amountDisplay = analysis?.parsedUri?.am || '';

  // Auto Voice Playback in Papa Mode
  useEffect(() => {
    if (analysis && papaMode && verdictMeta) {
      setIsSpeaking(true);
      playVoiceAdvisory({
        verdict: analysis.verdict,
        title: verdictMeta.title,
        oneLiner: () => verdictMeta.oneLiner(amountDisplay, payeeDisplay),
        actionText: verdictMeta.actionText,
        lang: lang,
        onEnd: () => setIsSpeaking(false)
      });
    }
  }, [analysis, papaMode]);

  const runCheck = (m = message, u = uri) => {
    if (!m && !u) return;
    const res = evaluateDisparity(m, u);
    setAnalysis(res);
  };

  const handleApplyClipboard = () => {
    if (clipboardCandidate) {
      setUri(clipboardCandidate);
      runCheck(message, clipboardCandidate);
      setClipboardCandidate('');
    }
  };

  const handleDirectIntentMapping = (intentType) => {
    if (!analysis) return;
    if (intentType === 'shopping') {
      setAnalysis({
        ...analysis,
        verdict: 'NO_DISPARITY_DETECTED',
        score: 0.05,
        signals: [{ id: 'INTENT_USER_OUTGOING', weight: -30 }]
      });
    } else if (intentType === 'receive') {
      setAnalysis({
        ...analysis,
        verdict: 'CRITICAL_INTENT_DISPARITY',
        score: 0.99,
        signals: [{ id: 'REVERSE_CHARGE_SIGNAL', weight: 80 }]
      });
    } else if (intentType === 'urgency') {
      setAnalysis({
        ...analysis,
        verdict: 'HIGH_INTENT_DISPARITY',
        score: 0.88,
        signals: [{ id: 'URGENCY_INTIMIDATION', weight: 45 }]
      });
    }
  };

  const applyPreset = (preset) => {
    setMessage(preset.message);
    setUri(preset.uri);
    const res = evaluateDisparity(preset.message, preset.uri);
    setAnalysis(res);
  };

  const handleScannedCode = (scanned) => {
    setShowScanner(false);
    if (scanned) {
      setUri(scanned);
      runCheck(message, scanned);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setFileError('');
    if (!file) return;

    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const res = await reader.decodeFromImageUrl(url);
      if (res && res.getText()) {
        handleScannedCode(res.getText());
      } else {
        setFileError(lang === 'en' ? 'No QR code found in this image.' : 'इस फोटो में क्यूआर कोड नहीं मिला।');
      }
    } catch {
      setFileError(lang === 'en' ? 'Could not decode QR. Please select a clearer photo.' : 'क्यूआर पढ़ने में असमर्थ। कृपया साफ फोटो चुनें।');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleReset = () => {
    setMessage('');
    setUri('');
    setAnalysis(null);
    setShowManualInput(false);
    setCopiedReport(false);
    setCopiedZk(false);
    setFileError('');
    setClipboardCandidate('');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const handleManualSpeech = () => {
    if (!analysis || !verdictMeta) return;
    if (isSpeaking) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    playVoiceAdvisory({
      verdict: analysis.verdict,
      title: verdictMeta.title,
      oneLiner: () => verdictMeta.oneLiner(amountDisplay, payeeDisplay),
      actionText: verdictMeta.actionText,
      lang: lang,
      onEnd: () => setIsSpeaking(false)
    });
  };

  const togglePapaMode = () => {
    setPapaMode((prev) => !prev);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const payHref = (analysis?.parsedUri?.rawUri && (analysis.parsedPayload || analysis.parsedUri).rawUri.startsWith('upi://')) 
    ? (analysis.parsedPayload || analysis.parsedUri).rawUri 
    : (uri.trim().startsWith('upi://') ? uri.trim() : null);

  const copyReportPack = () => {
    const reportText = `[CYBERCRIME REPORT PACK - UPI SENTINEL ADVISORY]
Assessment: ${verdictMeta?.title.en}
Severity: ${verdictMeta?.badge.en}
Payee Name: ${analysis?.parsedUri?.pn || 'Unknown Payee'}
Payee VPA: ${analysis?.parsedUri?.pa || 'Not Available'}
Amount Claimed: ₹${analysis?.parsedUri?.am || 'Not Specified'}
Flagged Reason: ${verdictMeta?.reason.en}
Timestamp: ${new Date().toLocaleString('en-IN')}
Status: Flagged by UPI Sentinel heuristic tool (Advisory only, not bank record).

-- AGAR PAISE KAT GAYE HAIN TO NEECHE DETAILS BHAR KAR 1930 PAR DEIN --
Bank Name: 
Account No (Last 4 digits): 
Txn Ref / UTR No: 
Exact Time of Debit: `;

    navigator.clipboard.writeText(reportText).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3000);
    });
  };

  const exportZkSignature = async () => {
    if (!analysis?.parsedUri) return;
    const zkData = await generateZkScamSignature((analysis.parsedPayload || analysis.parsedUri), verdictMeta?.badge?.en);
    if (!zkData) return;

    const exportString = JSON.stringify(zkData, null, 2);
    navigator.clipboard.writeText(exportString).then(() => {
      setCopiedZk(true);
      setTimeout(() => setCopiedZk(false), 3500);
    });
  };

  const shareToFamily = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://upi-sentinel-core.vercel.app';
    const amParam = encodeURIComponent(amountDisplay);
    const pnParam = encodeURIComponent(payeeDisplay);
    const typeParam = encodeURIComponent(verdictMeta?.badge?.[lang] || 'ReverseCharge');
    
    const previewUrl = `${origin}/api/og?am=${amParam}&pn=${pnParam}&type=${typeParam}&lang=${lang}`;

    const alertMsg = encodeURIComponent(
      `⚠️ *Alert! Suspicious UPI Trap Prevented*\n\n` +
      `Request: ${amountDisplay ? `₹${amountDisplay}` : 'funds'} from ${payeeDisplay}.\n\n` +
      `UPI Sentinel flagged this as a probable reverse-charge debit scam.\n` +
      `Never enter your UPI PIN to receive money!\n\n` +
      `Verified Alert:\n${previewUrl}`
    );
    window.open(`https://wa.me/?text=${alertMsg}`, '_blank');
  };

  const t = (obj) => {
    if (!obj) return '';
    return obj[lang] || obj.hi || obj.en || '';
  };

  return (
    <div className={`min-h-screen ${papaMode ? 'bg-black text-white' : 'bg-[#050811] text-slate-100'} flex flex-col font-sans relative selection:bg-cyan-500 selection:text-black`}>
      
      {!papaMode && (
        <div 
          className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-700 ${isDanger ? 'danger-glow' : ''}`}
          style={{
            background: isDanger 
              ? 'radial-gradient(circle at 50% 15%, rgba(225, 29, 72, 0.28), transparent 75%)'
              : isCaution
                ? 'radial-gradient(circle at 50% 15%, rgba(245, 158, 11, 0.2), transparent 75%)'
                : isSafe
                  ? 'radial-gradient(circle at 50% 15%, rgba(16, 185, 129, 0.2), transparent 75%)'
                  : 'radial-gradient(circle at 50% 15%, rgba(34, 211, 238, 0.15), transparent 75%)'
          }}
        />
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleFileUpload} 
        className="hidden" 
        aria-label="Upload QR Image"
      />

      {showScanner && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-[#050811]/90 backdrop-blur-md flex items-center justify-center text-cyan-400 font-mono text-xs">
            INITIALIZING SCANNER...
          </div>
        }>
          <QrScanner 
            onPayloadScanned={handleScannedCode} 
            onClose={() => setShowScanner(false)} 
          />
        </Suspense>
      )}

      {/* Language Selection Modal */}
      {showLangPicker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-slate-900 border border-white/20 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-sm font-bold text-white flex items-center space-x-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Select Language</span>
              </span>
              <button 
                type="button" 
                onClick={() => setShowLangPicker(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => switchLanguage(l.code)}
                  className={`p-2.5 rounded-2xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                    lang === l.code
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <div className="text-xs">{l.native}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{l.label}</div>
                  </div>
                  {lang === l.code && <Check className="w-4 h-4 text-cyan-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Cyber Navbar */}
      <header className="h-16 px-4 sm:px-6 border-b border-white/10 backdrop-blur-xl bg-[#050811]/75 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center font-black text-black text-sm shadow-[0_0_16px_rgba(34,211,238,0.4)]">
            ₹
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-white text-sm sm:text-base">
              {papaMode ? 'सुरक्षा साथी' : 'UPI SENTINEL'}
            </span>
            {!papaMode && (
              <span className="hidden sm:inline-block text-[10px] ml-2 text-cyan-400 font-mono tracking-widest uppercase bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                Zero-Server
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Papa Mode Toggle Button */}
          <button
            type="button"
            onClick={togglePapaMode}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all ${
              papaMode 
                ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.5)] border-2 border-white'
                : 'bg-white/10 text-slate-300 hover:text-white border border-white/15'
            }`}
            aria-label="Toggle Papa Mode"
          >
            <UserCheck className="w-4 h-4" />
            <span>{papaMode ? 'पापा मोड ON' : 'पापा मोड'}</span>
          </button>

          {!papaMode && (
            <>
              {isOffline && (
                <div className="flex items-center space-x-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline ✓</span>
                </div>
              )}

              {/* Language Selector Trigger */}
              <button
                type="button"
                onClick={() => setShowLangPicker(true)}
                className="flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors"
                aria-label="Switch Language"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>{currentLangObj.native}</span>
              </button>
            </>
          )}

          {analysis && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="Reset"
              aria-label="Reset Analysis"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </button>
          )}
        </div>
      </header>

      {/* Main Column */}
      <main className="flex-1 max-w-[430px] mx-auto w-full p-4 flex flex-col justify-center relative z-10 pb-28">
        
        {/* --- PAPA MODE VIEW --- */}
        {papaMode ? (
          <div className="space-y-6">
            {!analysis ? (
              <div className="space-y-6 text-center py-4">
                <div className="papa-card p-6 rounded-3xl space-y-2">
                  <h1 className="text-2xl font-black text-amber-300">
                    पेमेंट करने से पहले QR दिखाएं
                  </h1>
                  <p className="text-base text-slate-200 font-bold">
                    पैसे लेने के लिए कभी पिन (PIN) नहीं लगता। केवल पैसे कटने पर ही पिन डाला जाता है।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="w-full py-5 rounded-3xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 text-black font-black text-xl shadow-[0_0_35px_rgba(250,204,21,0.4)] flex items-center justify-center space-x-3 transition-all"
                >
                  <QrCode className="w-8 h-8 stroke-[2.5]" />
                  <span>कैमरा से QR स्कैन करें</span>
                </button>

                <a
                  href="tel:1930"
                  className="w-full py-4 rounded-3xl bg-rose-950 border-2 border-rose-500 text-rose-300 font-black text-base flex items-center justify-center space-x-2"
                >
                  <PhoneCall className="w-5 h-5 text-rose-400" />
                  <span>धोखा होने पर तुरंत 1930 मिलाएं</span>
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-6 rounded-3xl ${
                  analysis.verdict.includes('DISPARITY') ? 'papa-card-danger' : 'papa-card-safe'
                }`}>
                  <div className="flex items-center space-x-3">
                    {analysis.verdict.includes('DISPARITY') ? (
                      <ShieldAlert className="w-12 h-12 text-rose-400 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-12 h-12 text-emerald-400 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-mono font-bold uppercase text-white/80">
                        {analysis.verdict.includes('DISPARITY') ? t(verdictMeta?.badge) : t(verdictMeta?.badge)}
                      </span>
                      <h2 className="text-2xl font-black text-white">
                        {analysis.verdict.includes('DISPARITY') ? 'रुकिए! पिन मत डालिए' : 'दुकानदार को भुगतान'}
                      </h2>
                    </div>
                  </div>

                  <div className="my-5 p-4 rounded-2xl bg-black border border-white/20">
                    {(analysis.parsedPayload || analysis.parsedUri)?.am && (
                      <div className="text-4xl font-black text-rose-400 font-mono">
                        −₹{(analysis.parsedPayload || analysis.parsedUri).am}
                      </div>
                    )}
                    <p className="text-lg font-bold text-white mt-1">
                      {t(verdictMeta?.oneLiner(amountDisplay, payeeDisplay))}
                    </p>
                    <p className="text-sm font-semibold text-amber-300 mt-2">
                      {t(verdictMeta?.actionText)}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleManualSpeech}
                      className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 border-2 border-white/30 text-white font-black text-base flex items-center justify-center space-x-2"
                    >
                      <Volume2 className={`w-6 h-6 ${isSpeaking ? 'text-amber-400 animate-pulse' : 'text-white'}`} />
                      <span>{isSpeaking ? 'बोल रहा है...' : 'दोबारा आवाज़ में सुनें'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base flex items-center justify-center space-x-2"
                    >
                      <ShieldCheck className="w-6 h-6" />
                      <span>सुरक्षित रहें, इसे हटाएं</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (

          /* --- STANDARD MODE VIEW --- */
          <>
            {clipboardCandidate && !analysis && (
              <div className="mb-3 p-3 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 backdrop-blur-xl flex items-center justify-between shadow-[0_0_20px_rgba(34,211,238,0.25)] animate-in fade-in duration-200">
                <div className="flex items-center space-x-2 min-w-0 pr-2">
                  <ClipboardPaste className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-white truncate">
                      {lang === 'en' ? 'UPI Link Detected in Clipboard' : 'क्लिपबोर्ड से लिंक मिला'}
                    </div>
                    <div className="text-[10px] text-cyan-300/80 font-mono truncate">
                      {clipboardCandidate}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleApplyClipboard}
                    className="px-3 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-[11px] rounded-xl transition-all shadow-sm"
                  >
                    {lang === 'en' ? 'Scan' : 'जांचें'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setClipboardCandidate('')}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                    aria-label="Dismiss Clipboard Banner"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 1: SCANNER */}
            {activeTab === 'scan' && (
              <div className="space-y-4">
                {analysis && verdictMeta ? (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200" role={isDanger ? 'alert' : 'status'}>
                    <div className="bg-white/5 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
                      <div className="flex items-center justify-between pb-3 border-b border-dashed border-white/15">
                        <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">
                          {lang === 'en' ? 'Payment Snapshot' : 'भुगतान विवरण'}
                        </span>
                        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/50">
                          {lang === 'en' ? 'Analyzed on-device' : 'फोन पर जांचा गया'}
                        </span>
                      </div>

                      <div className="pt-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300 text-base shrink-0">
                            {(analysis.parsedPayload || analysis.parsedUri)?.pn?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-sm sm:text-base truncate">
                              {(analysis.parsedPayload || analysis.parsedUri)?.pn || payeeDisplay}
                            </div>
                            <div className="text-xs font-mono text-slate-400 truncate">
                              {(analysis.parsedPayload || analysis.parsedUri)?.pa || 'VPA Not Found'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-slate-400 uppercase font-mono">
                            {lang === 'en' ? 'Debit Amount' : 'कटने वाली रकम'}
                          </div>
                          <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                            {(analysis.parsedPayload || analysis.parsedUri)?.am ? `₹${(analysis.parsedPayload || analysis.parsedUri).am}` : '₹--'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`p-5 sm:p-6 rounded-3xl border shadow-2xl transition-all relative overflow-hidden ${
                      isDanger
                        ? 'bg-gradient-to-b from-rose-950/90 to-rose-900/60 border-rose-500/50 shadow-[0_0_50px_rgba(244,63,94,0.3)]'
                        : isCaution
                          ? 'bg-gradient-to-b from-amber-950/90 to-amber-900/60 border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.25)]'
                          : isSafe
                            ? 'bg-gradient-to-b from-emerald-950/90 to-emerald-900/60 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.3)]'
                            : 'bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-slate-700/60'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          {isDanger && (
                            <div className="p-2.5 bg-rose-600/30 rounded-2xl border border-rose-500/40 text-rose-400">
                              <ShieldAlert className="w-6 h-6" />
                            </div>
                          )}
                          {isCaution && (
                            <div className="p-2.5 bg-amber-600/30 rounded-2xl border border-amber-500/40 text-amber-400">
                              <AlertTriangle className="w-6 h-6" />
                            </div>
                          )}
                          {isSafe && (
                            <div className="p-2.5 bg-emerald-600/30 rounded-2xl border border-emerald-500/40 text-emerald-400">
                              <ShieldCheck className="w-6 h-6" />
                            </div>
                          )}
                          {isMalformed && (
                            <div className="p-2.5 bg-slate-700/40 rounded-2xl border border-slate-600 text-slate-300">
                              <HelpCircle className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] font-mono tracking-widest uppercase text-white/80 block">
                              {isStandaloneRetailScan 
                                ? (lang === 'en' ? 'MERCHANT CHECKOUT' : 'दुकान भुगतान') 
                                : t(verdictMeta.badge)}
                            </span>
                            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                              {isStandaloneRetailScan
                                ? (lang === 'en' ? 'Paying at a Merchant Store?' : 'दुकान पर भुगतान कर रहे हैं?')
                                : t(verdictMeta.title)}
                            </h2>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleManualSpeech}
                          className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/15"
                          title="Speak"
                          aria-label="Speak Verdict"
                        >
                          <Volume2 className={`w-5 h-5 ${isSpeaking ? 'text-cyan-400 animate-pulse' : 'text-slate-200'}`} />
                        </button>
                      </div>

                      <div className="my-4 p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
                        {isDanger && (analysis.parsedPayload || analysis.parsedUri)?.am && (
                          <div className="text-3xl font-black text-rose-400 leading-tight font-mono tracking-tight">
                            −₹{(analysis.parsedPayload || analysis.parsedUri).am}
                          </div>
                        )}
                        <div className="text-sm sm:text-base font-bold text-white leading-snug">
                          {isStandaloneRetailScan 
                            ? (lang === 'en' 
                                ? `You will pay ₹${amountDisplay || '--'} to ${payeeDisplay}. Remember: QR scan strictly debits money, never receives.`
                                : `आप ₹${amountDisplay || '--'} ${payeeDisplay} को देंगे। याद रखें: QR स्कैन करने से कभी पैसे आते नहीं, हमेशा कटते हैं।`)
                            : t(verdictMeta.oneLiner(amountDisplay, payeeDisplay))}
                        </div>
                        <div className="text-xs text-amber-300 font-semibold pt-0.5">
                          {isStandaloneRetailScan 
                            ? (lang === 'en' ? 'Safe to proceed if you are buying items at this store.' : 'दुकान पर सामान्य खरीदारी के लिए आगे बढ़ सकते हैं।')
                            : t(verdictMeta.actionText)}
                        </div>
                      </div>

                      {analysis.signals && analysis.signals.filter(s => s.weight > 0 && SIGNAL_I18N[s.id]).length > 0 && (
                        <div className="py-2 flex flex-wrap gap-1.5">
                          {analysis.signals.filter(s => s.weight > 0 && SIGNAL_I18N[s.id]).map((s, i) => (
                            <span
                              key={s.id}
                              style={{ animationDelay: `${i * 100}ms` }}
                              className="chip-in text-[11px] px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200 font-medium"
                            >
                              {t(SIGNAL_I18N[s.id])}
                            </span>
                          ))}
                        </div>
                      )}

                      {isStandaloneRetailScan && (
                        <div className="my-3 p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-2xl space-y-1.5">
                          <div className="text-[11px] font-bold text-cyan-300">
                            {lang === 'en' ? 'What is this payment for?' : 'यह भुगतान किसलिए है?'}
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleDirectIntentMapping('shopping')}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-center text-[10px] text-slate-200 font-semibold flex flex-col items-center space-y-1"
                            >
                              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{lang === 'en' ? 'Shopping' : 'खरीदारी'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDirectIntentMapping('receive')}
                              className="p-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/50 border border-rose-800/50 text-center text-[10px] text-rose-300 font-semibold flex flex-col items-center space-y-1"
                            >
                              <Coins className="w-3.5 h-3.5 text-rose-400" />
                              <span>{lang === 'en' ? 'Receive Money' : 'पैसे लेने हैं'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDirectIntentMapping('urgency')}
                              className="p-2 rounded-xl bg-amber-950/50 hover:bg-amber-900/50 border border-amber-800/50 text-center text-[10px] text-amber-300 font-semibold flex flex-col items-center space-y-1"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              <span>{lang === 'en' ? 'Urgent Call' : 'जल्दी बोला'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 text-xs text-slate-300 pt-1">
                        <div>
                          <span className="font-bold text-white">{lang === 'en' ? 'Reason: ' : 'कारण: '}</span> 
                          {t(verdictMeta.reason)}
                        </div>
                        <div>
                          <span className="font-bold text-white">{lang === 'en' ? 'Advice: ' : 'सलाह: '}</span> 
                          {t(verdictMeta.recommendation)}
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2.5 items-center">
                        <button
                          type="button"
                          onClick={handleReset}
                          className="w-full sm:flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all flex items-center justify-center space-x-1.5"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>{lang === 'en' ? 'Stay Safe, Dismiss' : 'सुरक्षित रहें, लिंक हटाएं'}</span>
                        </button>

                        {isDanger && (
                          <div className="text-center w-full sm:w-auto">
                            {canProceed && payHref ? (
                              <a
                                href={payHref}
                                className="text-xs text-slate-400 hover:text-white underline font-medium p-1.5 block"
                              >
                                {lang === 'en' ? 'Proceed anyway' : 'फिर भी आगे बढ़ें'}
                              </a>
                            ) : (
                              <span className="text-[11px] text-rose-300/70 font-mono block p-1.5">
                                {lang === 'en' ? `Unlocked in ${countdown}s...` : `${countdown} सेकंड में अनलॉक होगा...`}
                              </span>
                            )}
                          </div>
                        )}

                        {(isCaution || isSafe) && payHref && (
                          <div className="text-center w-full sm:w-auto">
                            {isStandaloneRetailScan || isSafe || canProceed ? (
                              <a
                                href={payHref}
                                className={`py-3.5 px-5 rounded-2xl font-bold text-xs inline-flex items-center space-x-1 shadow-md ${
                                  isSafe 
                                    ? 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-cyan-400/30' 
                                    : 'bg-amber-500 hover:bg-amber-400 text-black'
                                }`}
                              >
                                <span>{lang === 'en' ? 'Open UPI App' : 'यूपीआई ऐप में खोलें'}</span>
                                <ExternalLink className="w-3.5 h-3.5 ml-1" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-amber-300/80 font-mono block p-1.5">
                                {lang === 'en' ? `Wait ${countdown}s...` : `${countdown} सेकंड रुकें...`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Danger Utilities */}
                      {isDanger && (
                        <div className="mt-4 pt-3.5 border-t border-white/10 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={shareToFamily}
                              className="py-2.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>{lang === 'en' ? 'Share with Family' : 'फैमिली को भेजें'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={copyReportPack}
                              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5 text-cyan-400" />
                              <span>{copiedReport ? 'Copied ✓' : 'Report Pack'}</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={exportZkSignature}
                            className="w-full py-2 px-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/50 text-cyan-300 text-[11px] font-mono flex items-center justify-center space-x-1.5 transition-colors"
                          >
                            <Radio className="w-3.5 h-3.5 text-cyan-400" />
                            <span>
                              {copiedZk 
                                ? 'Safe SHA-256 Hash Copied ✓' 
                                : 'ZK Community Export (Zero PII)'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-4 pt-1">
                    <div className="inline-flex items-center space-x-1.5 bg-cyan-950/60 border border-cyan-800/50 px-3 py-1 rounded-full text-xs text-cyan-300 text-center font-medium shadow-md">
                      <AlertTriangle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>
                        {lang === 'en' 
                          ? 'Someone claims they sent money? Verify here first.' 
                          : 'कोई पैसा भेजने को कह रहा है? पहले यहाँ चेक करें।'}
                      </span>
                    </div>

                    <div className="relative flex items-center justify-center my-1">
                      <div className="w-[min(55vw,220px)] h-[min(55vw,220px)] rounded-full border border-cyan-500/25 flex items-center justify-center relative radar-ring">
                        <div className="w-[min(44vw,176px)] h-[min(44vw,176px)] rounded-full border border-cyan-500/40 flex items-center justify-center shadow-[0_0_45px_rgba(34,211,238,0.25)]">
                          <button
                            type="button"
                            onClick={() => setShowScanner(true)}
                            className="w-[min(34vw,136px)] h-[min(34vw,136px)] rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 hover:scale-105 active:scale-95 transition-all shadow-[0_0_35px_rgba(34,211,238,0.5)] flex flex-col items-center justify-center text-white space-y-1.5 group"
                            aria-label="Scan QR Code"
                          >
                            <QrCode className="w-9 h-9 stroke-[2.2] text-white transition-transform group-hover:rotate-6 drop-shadow-[0_0_10px_rgba(34,211,238,0.85)]" />
                            <span className="font-extrabold text-[11px] tracking-wider uppercase text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]">
                              {lang === 'en' ? 'SCAN QR' : 'स्कैन करें'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="text-center space-y-1 max-w-xs">
                      <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                        {lang === 'en' ? 'Verify Before Entering PIN' : 'पे करने से पहले, एक सेकंड रुको'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {lang === 'en' 
                          ? 'Zero-server reverse-charge scam detection.' 
                          : 'रिवर्स-चार्ज और फेक पेमेंट का ऑन-डिवाइस स्कैन।'}
                      </p>
                    </div>

                    {fileError && (
                      <div className="w-full text-center text-xs text-rose-400 bg-rose-950/60 border border-rose-800/60 p-2 rounded-xl">
                        {fileError}
                      </div>
                    )}

                    <div className="w-full flex gap-2.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <UploadCloud className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{lang === 'en' ? 'Upload Image' : 'फोटो चुनें'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowManualInput(!showManualInput)}
                        className="flex-1 py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{showManualInput ? (lang === 'en' ? 'Hide Form' : 'फॉर्म छिपाएं') : (lang === 'en' ? 'Paste Text' : 'टेक्स्ट पेस्ट करें')}</span>
                      </button>
                    </div>

                    <div className="w-full pt-1">
                      <div className="text-[11px] font-mono text-slate-400 uppercase text-center mb-1.5 tracking-wider">
                        {lang === 'en' ? 'Try an example:' : 'उदाहरण चलाकर देखें:'}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {DEMO_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applyPreset(p)}
                            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left transition-all flex flex-col justify-between space-y-1"
                          >
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border inline-block w-fit ${p.tagColor}`}>
                              {p.tag[lang] || p.tag.en}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-200 leading-tight">
                              {p.label[lang] || p.label.en}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {showManualInput && (
                      <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 space-y-3">
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">UPI Link / VPA</label>
                          <input
                            type="text"
                            placeholder="upi://pay?pa=... or name@bank"
                            value={uri}
                            onChange={(e) => setUri(e.target.value)}
                            className="w-full text-xs font-mono p-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-400 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">WhatsApp / SMS Context</label>
                          <textarea
                            rows={2}
                            placeholder="e.g. advance Rs 5000 bhej diye hain, PIN dalo..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full text-xs p-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-400 text-white resize-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => runCheck()}
                          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-extrabold text-xs rounded-xl shadow-md hover:brightness-110 transition-all flex items-center justify-center space-x-1.5"
                        >
                          <span>{lang === 'en' ? 'Run Analysis' : 'जांच करें'}</span>
                          <ArrowRight className="w-4 h-4 text-black" />
                        </button>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400 flex items-center justify-center space-x-1.5 font-mono pt-1">
                      <Lock className="w-3 h-3 text-cyan-400" />
                      <span>0 Servers · 0 Logs · 100% Client-Side Engine</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SEEKHO */}
            {activeTab === 'learn' && (
              <div className="space-y-4">
                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 space-y-3">
                  <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    {lang === 'en' ? 'How Sentinel Works:' : 'UPI Sentinel कैसे काम करता है:'}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-2xl bg-black/30 border border-white/5">
                      <QrCode className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                      <div className="text-[11px] font-bold text-white">{lang === 'en' ? '1. Scan' : '1. स्कैन'}</div>
                      <div className="text-[11px] text-slate-400">{lang === 'en' ? 'Camera / Photo' : 'कैमरा या फोटो'}</div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-black/30 border border-white/5">
                      <Lock className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                      <div className="text-[11px] font-bold text-white">{lang === 'en' ? '2. On-Device' : '2. डिवाइस पर'}</div>
                      <div className="text-[11px] text-slate-400">{lang === 'en' ? 'Zero Data Leak' : 'जीरो डेटा लीक'}</div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-black/30 border border-white/5">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                      <div className="text-[11px] font-bold text-white">{lang === 'en' ? '3. Verify' : '3. पुष्टि'}</div>
                      <div className="text-[11px] text-slate-400">{lang === 'en' ? 'Real Payee' : 'असली प्राप्तकर्ता'}</div>
                    </div>
                  </div>
                </div>

                <div className="border-b border-white/10 pb-2">
                  <h2 className="text-lg font-black text-white flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-cyan-400" />
                    <span>{lang === 'en' ? 'Top 5 UPI Scam Patterns' : '5 सबसे बड़े यूपीआई स्कैम'}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'en' ? 'Learn common traps and golden security rules.' : 'स्कैमर्स के जाल और उनसे बचने के आसान नियम।'}
                  </p>
                </div>

                <div className="space-y-3">
                  {SCAM_ARCHIVES.map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-cyan-300">
                        {item.title[lang] || item.title.en}
                      </h3>
                      <div className="text-xs text-slate-300 leading-relaxed">
                        <strong className="text-white">{lang === 'en' ? 'Trap: ' : 'जाल: '}</strong> 
                        {item.victim[lang] || item.victim.en}
                      </div>
                      <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 p-2.5 rounded-xl font-medium">
                        🛡️ <strong className="text-emerald-300">{lang === 'en' ? 'Rule: ' : 'बचाव: '}</strong> 
                        {item.rule[lang] || item.rule.en}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            
            {/* TAB: SCAM SIMULATOR DOJO */}
            {activeTab === 'dojo' && (
              <Suspense fallback={<div className="p-10 text-center text-xs font-mono text-emerald-400">LOADING DOJO ARENA...</div>}>
                <ScamDojo />
              </Suspense>
            )}

            {/* TAB: SLIP OCR FORENSICS */}
            {activeTab === 'receipt' && (
              <Suspense fallback={<div className="p-10 text-center text-xs font-mono text-emerald-400">INITIALIZING OCR ENGINE...</div>}>
                <ReceiptScanner />
              </Suspense>
            )}

            {/* TAB: VOICE RADAR */}
            {activeTab === 'voice' && (
              <Suspense fallback={<div className="p-10 text-center text-xs font-mono text-emerald-400">INITIALIZING AUDIO ANALYZER...</div>}>
                <VoiceVerifier />
              </Suspense>
            )}
{/* TAB 3: EMERGENCY HELPLINE */}
            {activeTab === 'emergency' && (
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5">
                <div className="flex items-center space-x-3 text-rose-400">
                  <PhoneCall className="w-7 h-7 shrink-0" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      {lang === 'en' ? 'National Cyber Helpline (1930)' : 'राष्ट्रीय साइबर हेल्पलाइन (1930)'}
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">
                      {lang === 'en' ? 'Immediate Financial Fraud Reporting' : 'तत्काल वित्तीय धोखाधड़ी रिपोर्टिंग'}
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {lang === 'en'
                    ? 'If funds were debited fraudulently, call within the Golden Hour (first 1-2 hours). Nodal bank officers can freeze recipient accounts.'
                    : 'अगर धोखे से खाते से पैसे कट चुके हैं, तो गोल्डन ऑवर (शुरुआती 1-2 घंटे) के अंदर कॉल करें। नोडल बैंक अधिकारी फ्रॉड खाते को तुरंत फ्रीज कर सकते हैं।'}
                </p>

                <a
                  href="tel:1930"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-sm shadow-[0_0_25px_rgba(244,63,94,0.35)] flex items-center justify-center space-x-2 transition-all"
                >
                  <PhoneCall className="w-4 h-4 animate-bounce" />
                  <span>{lang === 'en' ? 'Call 1930 (Toll Free)' : 'कॉल करें: 1930 (टोल-फ्री)'}</span>
                </a>

                <div className="p-3.5 bg-black/40 rounded-2xl border border-white/10 space-y-1">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">
                    {lang === 'en' ? 'Official Portal' : 'आधिकारिक पोर्टल'}
                  </span>
                  <a 
                    href="https://cybercrime.gov.in" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs font-bold text-cyan-400 underline flex items-center space-x-1"
                  >
                    <span>cybercrime.gov.in</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </div>
              </div>
            )}

            {/* Statutory Disclaimer */}
            <footer className="mt-6 pt-3 border-t border-white/5 text-center text-[11px] text-slate-400 space-y-1">
              <p>
                {lang === 'en'
                  ? 'Independent Advisory Utility · Not affiliated with NPCI, UPI, or banking institutions.'
                  : 'स्वतंत्र सुरक्षा परामर्श उपयोगिता · NPCI, UPI, या किसी भी बैंक से संबद्ध नहीं।'}
              </p>
              <p>
                {lang === 'en'
                  ? 'Advisory output is a client-side disparity heuristic and not a financial guarantee.'
                  : 'यह निष्कर्ष केवल एक ऑन-डिवाइस सुरक्षा अनुमान है और कोई वित्तीय गारंटी नहीं है।'}
              </p>
            </footer>

            {/* Bottom Dock Navigation */}
            <nav className="fixed bottom-4 inset-x-0 mx-auto w-[96%] max-w-xl bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-full p-1.5 flex items-center justify-between gap-1 shadow-2xl z-40">
              <button
                type="button"
                onClick={() => setActiveTab('scan')}
                className={`flex-1 py-2 px-1 rounded-full text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                  activeTab === 'scan' ? 'bg-cyan-400 text-black shadow-lg shadow-cyan-400/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'en' ? 'Scanner' : 'स्कैनर'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('dojo')}
                className={`flex-1 py-2 px-1 rounded-full text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                  activeTab === 'dojo' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0 text-inherit" />
                <span>{lang === 'en' ? 'Dojo' : 'डोजो'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('receipt')}
                className={`flex-1 py-2 px-1 rounded-full text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                  activeTab === 'receipt' ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-400/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0 text-inherit" />
                <span>{lang === 'en' ? 'Slip' : 'रसीद'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('voice')}
                className={`flex-1 py-2 px-1 rounded-full text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                  activeTab === 'voice' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5 shrink-0 text-inherit" />
                <span>{lang === 'en' ? 'Voice' : 'वॉइस'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('learn')}
                className={`flex-1 py-2 px-1 rounded-full text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                  activeTab === 'learn' ? 'bg-cyan-400 text-black shadow-lg shadow-cyan-400/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0 text-inherit" />
                <span>{lang === 'en' ? 'Learn' : 'सीखें'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('emergency')}
                className={`flex-1 py-2 px-1 rounded-full text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                  activeTab === 'emergency' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5 shrink-0 text-inherit" />
                <span>1930</span>
              </button>
            </nav>
          </>
        )}
      </main>
    </div>
  );
}
