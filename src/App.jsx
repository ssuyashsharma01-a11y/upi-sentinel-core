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
  Zap
} from 'lucide-react';
import { evaluateDisparity } from './engine/disparityEngine.js';
import { extractSharedPayload } from './utils/ingestion.js';
import { DEMO_PRESETS } from './data/presets.js';
import { VERDICT_I18N, SIGNAL_I18N } from './i18n/verdicts.js';

const QrScanner = lazy(() => import('./components/QrScanner.jsx'));

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
  const [lang, setLang] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('upi_sentinel_lang');
      if (saved) return saved;
      return navigator.language?.startsWith('hi') ? 'hi' : 'en';
    }
    return 'hi';
  });

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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [fileError, setFileError] = useState('');

  const fileInputRef = useRef(null);

  const switchLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('upi_sentinel_lang', newLang);
  };

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

      if (/[\u0900-\u097F]/.test(activeMsg)) {
        switchLanguage('hi');
      }

      const res = evaluateDisparity(activeMsg, activeUri);
      setAnalysis(res);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const isDanger = analysis?.verdict === 'CRITICAL_INTENT_DISPARITY' || analysis?.verdict === 'HIGH_INTENT_DISPARITY';
  const isCaution = analysis?.verdict === 'INSUFFICIENT_CONTEXT';
  const isSafe = analysis?.verdict === 'NO_DISPARITY_DETECTED';
  const isMalformed = analysis?.verdict === 'MALFORMED_PAYLOAD';

  useEffect(() => {
    setCanProceed(false);
    const timerDuration = isDanger ? 5 : (isCaution ? 2 : 0);
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
  }, [analysis, isDanger, isCaution]);

  const runCheck = (m = message, u = uri) => {
    if (!m && !u) return;
    const res = evaluateDisparity(m, u);
    setAnalysis(res);
  };

  // Instant Intent Chip handler for retail QR codes
  const handleIntentSelection = (intentType) => {
    let syntheticContext = message;
    if (intentType === 'shopping') {
      syntheticContext = 'Dukaan par saman khareed raha hu bill payment';
    } else if (intentType === 'receive') {
      syntheticContext = 'Mujhe samne wale se paisa receive karna tha refund';
    } else if (intentType === 'urgency') {
      syntheticContext = 'Urgent call karke officer ne bola abhi turant pay karo';
    }
    setMessage(syntheticContext);
    runCheck(syntheticContext, uri);
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
        setFileError(lang === 'hi' ? 'इस फोटो में क्यूआर कोड नहीं मिला।' : 'No QR code found in this image.');
      }
    } catch {
      setFileError(lang === 'hi' ? 'क्यूआर पढ़ने में असमर्थ। कृपया साफ फोटो चुनें।' : 'Could not decode QR. Please select a clearer photo.');
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
    setFileError('');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const verdictMeta = analysis ? (VERDICT_I18N[analysis.verdict] || VERDICT_I18N.INSUFFICIENT_CONTEXT) : null;
  const payeeDisplay = analysis?.parsedUri?.pn || analysis?.parsedUri?.pa || (lang === 'hi' ? 'प्राप्तकर्ता' : 'Payee');
  const amountDisplay = analysis?.parsedUri?.am || '';

  const speakVerdict = () => {
    if (!('speechSynthesis' in window) || !verdictMeta) return;
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const titleText = verdictMeta.title[lang] || verdictMeta.title.en;
    const oneLiner = verdictMeta.oneLiner(amountDisplay, payeeDisplay)[lang] || '';
    const actionText = verdictMeta.actionText[lang] || verdictMeta.actionText.en;

    const textToRead = `${titleText}. ${oneLiner} ${actionText}`;

    const u = new SpeechSynthesisUtterance(textToRead);
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    u.rate = 0.92;
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  const payHref = (analysis?.parsedUri?.rawUri && analysis.parsedUri.rawUri.startsWith('upi://')) 
    ? analysis.parsedUri.rawUri 
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

  const shareToFamily = () => {
    const alertMsg = encodeURIComponent(
      lang === 'hi'
        ? `⚠️ सावधान! मुझे ${payeeDisplay} के नाम से ₹${amountDisplay || 'पैसे'} कटने का संदिग्ध UPI पेमेंट लिंक आया था।\n\n` +
          `UPI Sentinel ने इसे संभावित रिवर्स-चार्ज धोखाधड़ी के रूप में फ्लैग किया है।\n` +
          `ध्यान रखें: पैसे प्राप्त करने या रिफंड के लिए कभी भी UPI PIN दर्ज न करें!`
        : `⚠️ Alert! I received a suspicious UPI payment link from ${payeeDisplay} requesting ₹${amountDisplay || 'funds'}.\n\n` +
          `UPI Sentinel flagged this as a probable reverse-charge scam trap.\n` +
          `Never enter your UPI PIN to receive money or refunds!`
    );
    window.open(`https://wa.me/?text=${alertMsg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans relative selection:bg-cyan-500 selection:text-black">
      
      {/* Dynamic Ambient Background */}
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

      {/* Floating Cyber Navbar */}
      <header className="h-16 px-4 sm:px-6 border-b border-white/10 backdrop-blur-xl bg-[#050811]/75 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center font-black text-black text-sm shadow-[0_0_16px_rgba(34,211,238,0.4)]">
            ₹
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-white text-sm sm:text-base">UPI SENTINEL</span>
            <span className="hidden sm:inline-block text-[10px] ml-2 text-cyan-400 font-mono tracking-widest uppercase bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              Zero-Server
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isOffline && (
            <div className="flex items-center space-x-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full">
              <WifiOff className="w-3 h-3" />
              <span>Offline ✓</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => switchLanguage(lang === 'hi' ? 'en' : 'hi')}
            className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors"
            aria-label="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{lang === 'hi' ? 'English' : 'हिंदी'}</span>
          </button>

          {analysis && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
              title={lang === 'hi' ? 'रीसेट करें' : 'Reset'}
              aria-label="Reset Analysis"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </button>
          )}
        </div>
      </header>

      {/* Main Column */}
      <main className="flex-1 max-w-[420px] mx-auto w-full p-4 flex flex-col justify-center relative z-10 pb-28">
        
        {/* TAB 1: SCANNER */}
        {activeTab === 'scan' && (
          <div className="space-y-4">

            {analysis && verdictMeta ? (
              /* RESULT VIEW */
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200" role={isDanger ? 'alert' : 'status'}>
                
                {/* Boarding Pass Snapshot */}
                <div className="bg-white/5 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-dashed border-white/15">
                    <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">
                      {lang === 'hi' ? 'भुगतान विवरण' : 'Payment Snapshot'}
                    </span>
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/50">
                      {lang === 'hi' ? 'फोन पर जांचा गया' : 'Analyzed on-device'}
                    </span>
                  </div>

                  <div className="pt-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300 text-base shrink-0">
                        {analysis.parsedUri?.pn?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm sm:text-base truncate">
                          {analysis.parsedUri?.pn || (lang === 'hi' ? 'अज्ञात प्राप्तकर्ता' : 'Unknown Payee')}
                        </div>
                        <div className="text-xs font-mono text-slate-400 truncate">
                          {analysis.parsedUri?.pa || 'VPA Not Found'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400 uppercase font-mono">
                        {lang === 'hi' ? 'कटने वाली रकम' : 'Debit Amount'}
                      </div>
                      <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                        {analysis.parsedUri?.am ? `₹${analysis.parsedUri.am}` : '₹--'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verdict Card */}
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
                          {verdictMeta.badge[lang] || verdictMeta.badge.en}
                        </span>
                        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                          {verdictMeta.title[lang] || verdictMeta.title.en}
                        </h2>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={speakVerdict}
                      className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/15"
                      title={lang === 'hi' ? 'बोलकर सुनें' : 'Speak'}
                      aria-label="Speak Verdict"
                    >
                      <Volume2 className={`w-5 h-5 ${isSpeaking ? 'text-cyan-400 animate-pulse' : 'text-slate-200'}`} />
                    </button>
                  </div>

                  {/* Shocker Debit Tag */}
                  <div className="my-4 p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
                    {isDanger && analysis.parsedUri?.am && (
                      <div className="text-3xl font-black text-rose-400 leading-tight font-mono tracking-tight">
                        −₹{analysis.parsedUri.am}
                      </div>
                    )}
                    <div className="text-sm sm:text-base font-bold text-white leading-snug">
                      {verdictMeta.oneLiner(amountDisplay, payeeDisplay)[lang] || verdictMeta.oneLiner(amountDisplay, payeeDisplay).en}
                    </div>
                    <div className="text-xs text-amber-300 font-semibold pt-0.5">
                      {verdictMeta.actionText[lang] || verdictMeta.actionText.en}
                    </div>
                  </div>

                  {/* Dynamic Staggered Signal Chips */}
                  {analysis.signals && analysis.signals.filter(s => s.weight > 0 && SIGNAL_I18N[s.id]).length > 0 && (
                    <div className="py-2 flex flex-wrap gap-1.5">
                      {analysis.signals.filter(s => s.weight > 0 && SIGNAL_I18N[s.id]).map((s, i) => (
                        <span
                          key={s.id}
                          style={{ animationDelay: `${i * 100}ms` }}
                          className="chip-in text-[11px] px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200 font-medium"
                        >
                          {SIGNAL_I18N[s.id][lang] || SIGNAL_I18N[s.id].en}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Signals Advice */}
                  <div className="space-y-1 text-xs text-slate-300 pt-1">
                    <div>
                      <span className="font-bold text-white">{lang === 'hi' ? 'कारण: ' : 'Reason: '}</span> 
                      {verdictMeta.reason[lang] || verdictMeta.reason.en}
                    </div>
                    <div>
                      <span className="font-bold text-white">{lang === 'hi' ? 'सलाह: ' : 'Advice: '}</span> 
                      {verdictMeta.recommendation[lang] || verdictMeta.recommendation.en}
                    </div>
                  </div>

                  {/* Decision Actions */}
                  <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2.5 items-center">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="w-full sm:flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all flex items-center justify-center space-x-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{lang === 'hi' ? 'सुरक्षित रहें, लिंक हटाएं' : 'Stay Safe, Dismiss'}</span>
                    </button>

                    {isDanger && (
                      <div className="text-center w-full sm:w-auto">
                        {canProceed && payHref ? (
                          <a
                            href={payHref}
                            className="text-xs text-slate-400 hover:text-white underline font-medium p-1.5 block"
                          >
                            {lang === 'hi' ? 'फिर भी आगे बढ़ें' : 'Proceed anyway'}
                          </a>
                        ) : (
                          <span className="text-[11px] text-rose-300/70 font-mono block p-1.5">
                            {lang === 'hi' ? `${countdown} सेकंड में अनलॉक होगा...` : `Unlocked in ${countdown}s...`}
                          </span>
                        )}
                      </div>
                    )}

                    {isCaution && payHref && (
                      <div className="text-center w-full sm:w-auto">
                        {canProceed ? (
                          <a
                            href={payHref}
                            className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs inline-flex items-center space-x-1"
                          >
                            <span>{lang === 'hi' ? 'सावधानी से आगे बढ़ें' : 'Continue with Caution'}</span>
                            <ExternalLink className="w-3.5 h-3.5 ml-1" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-amber-300/80 font-mono block p-1.5">
                            {lang === 'hi' ? `${countdown} सेकंड रुकें...` : `Wait ${countdown}s...`}
                          </span>
                        )}
                      </div>
                    )}

                    {isSafe && payHref && (
                      <a
                        href={payHref}
                        className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs text-center flex items-center justify-center space-x-1 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                      >
                        <span>{lang === 'hi' ? 'यूपीआई ऐप में खोलें' : 'Open UPI App'}</span>
                        <ExternalLink className="w-4 h-4 ml-1" />
                      </a>
                    )}
                  </div>

                  {/* Danger Utilities */}
                  {isDanger && (
                    <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={shareToFamily}
                        className="py-2.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{lang === 'hi' ? 'फैमिली को भेजें' : 'Share with Family'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={copyReportPack}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{copiedReport ? (lang === 'hi' ? 'कॉपी हुआ ✓' : 'Copied ✓') : 'Report Pack'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (

              /* HERO SCANNER SCREEN */
              <div className="flex flex-col items-center justify-center space-y-4 pt-1">
                
                {/* Contextual Hook */}
                <div className="inline-flex items-center space-x-1.5 bg-cyan-950/60 border border-cyan-800/50 px-3 py-1 rounded-full text-xs text-cyan-300 text-center font-medium shadow-md">
                  <AlertTriangle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    {lang === 'hi' 
                      ? 'कोई पैसा भेजने को कह रहा है? पहले यहाँ चेक करें।' 
                      : 'Someone claims they sent money? Verify here first.'}
                  </span>
                </div>

                {/* Radar Ring */}
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
                          {lang === 'hi' ? 'स्कैन करें' : 'SCAN QR'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-1 max-w-xs">
                  <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                    {lang === 'hi' ? 'पे करने से पहले, एक सेकंड रुको' : 'Verify Before Entering PIN'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {lang === 'hi' 
                      ? 'रिवर्स-चार्ज और फेक पेमेंट का ऑन-डिवाइस स्कैन।' 
                      : 'Zero-server reverse-charge scam detection.'}
                  </p>
                </div>

                {fileError && (
                  <div className="w-full text-center text-xs text-rose-400 bg-rose-950/60 border border-rose-800/60 p-2 rounded-xl">
                    {fileError}
                  </div>
                )}

                {/* Secondary Fast Actions */}
                <div className="w-full flex gap-2.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{lang === 'hi' ? 'फोटो चुनें' : 'Upload Image'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="flex-1 py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{showManualInput ? (lang === 'hi' ? 'फॉर्म छिपाएं' : 'Hide Form') : (lang === 'hi' ? 'टेक्स्ट पेस्ट करें' : 'Paste Text')}</span>
                  </button>
                </div>

                {/* Intent Chips for Retail/Direct QR Scans */}
                {uri && !analysis && (
                  <div className="w-full bg-cyan-950/40 border border-cyan-800/50 rounded-2xl p-3 space-y-2">
                    <div className="text-[11px] font-bold text-cyan-300">
                      {lang === 'hi' ? 'आप यह भुगतान क्यों कर रहे हैं?' : 'Why are you making this payment?'}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleIntentSelection('shopping')}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-center text-[10px] text-slate-200 font-semibold flex flex-col items-center space-y-1"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{lang === 'hi' ? 'सामान खरीदा' : 'Shopping'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleIntentSelection('receive')}
                        className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 text-center text-[10px] text-rose-300 font-semibold flex flex-col items-center space-y-1"
                      >
                        <Coins className="w-3.5 h-3.5 text-rose-400" />
                        <span>{lang === 'hi' ? 'पैसे पाने हैं' : 'To Receive'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleIntentSelection('urgency')}
                        className="p-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/40 text-center text-[10px] text-amber-300 font-semibold flex flex-col items-center space-y-1"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>{lang === 'hi' ? 'जल्दी में बोला' : 'Urgent Call'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Example Presets Header */}
                <div className="w-full pt-1">
                  <div className="text-[11px] font-mono text-slate-400 uppercase text-center mb-1.5 tracking-wider">
                    {lang === 'hi' ? 'उदाहरण चलाकर देखें:' : 'Try an example:'}
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

                {/* Dropdown Manual Input */}
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
                      <span>{lang === 'hi' ? 'जांच करें' : 'Run Analysis'}</span>
                      <ArrowRight className="w-4 h-4 text-black" />
                    </button>
                  </div>
                )}

                {/* Zero Server Proof */}
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
                {lang === 'hi' ? 'UPI Sentinel कैसे काम करता है:' : 'How Sentinel Works:'}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-2xl bg-black/30 border border-white/5">
                  <QrCode className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <div className="text-[11px] font-bold text-white">{lang === 'hi' ? '1. स्कैन' : '1. Scan'}</div>
                  <div className="text-[11px] text-slate-400">{lang === 'hi' ? 'कैमरा या फोटो' : 'Camera / Photo'}</div>
                </div>

                <div className="p-2.5 rounded-2xl bg-black/30 border border-white/5">
                  <Lock className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <div className="text-[11px] font-bold text-white">{lang === 'hi' ? '2. डिवाइस पर' : '2. On-Device'}</div>
                  <div className="text-[11px] text-slate-400">{lang === 'hi' ? 'जीरो डेटा लीक' : 'Zero Data Leak'}</div>
                </div>

                <div className="p-2.5 rounded-2xl bg-black/30 border border-white/5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <div className="text-[11px] font-bold text-white">{lang === 'hi' ? '3. पुष्टि' : '3. Verify'}</div>
                  <div className="text-[11px] text-slate-400">{lang === 'hi' ? 'असली प्राप्तकर्ता' : 'Real Payee'}</div>
                </div>
              </div>
            </div>

            <div className="border-b border-white/10 pb-2">
              <h2 className="text-lg font-black text-white flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <span>{lang === 'hi' ? '5 सबसे बड़े यूपीआई स्कैम' : 'Top 5 UPI Scam Patterns'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {lang === 'hi' ? 'स्कैमर्स के जाल और उनसे बचने के आसान नियम।' : 'Learn common traps and golden security rules.'}
              </p>
            </div>

            <div className="space-y-3">
              {SCAM_ARCHIVES.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <h3 className="text-xs sm:text-sm font-bold text-cyan-300">
                    {item.title[lang] || item.title.en}
                  </h3>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-white">{lang === 'hi' ? 'जाल: ' : 'Trap: '}</strong> 
                    {item.victim[lang] || item.victim.en}
                  </div>
                  <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 p-2.5 rounded-xl font-medium">
                    🛡️ <strong className="text-emerald-300">{lang === 'hi' ? 'बचाव: ' : 'Rule: '}</strong> 
                    {item.rule[lang] || item.rule.en}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: EMERGENCY HELPLINE */}
        {activeTab === 'emergency' && (
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center space-x-3 text-rose-400">
              <PhoneCall className="w-7 h-7 shrink-0" />
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  {lang === 'hi' ? 'राष्ट्रीय साइबर हेल्पलाइन (1930)' : 'National Cyber Helpline (1930)'}
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  {lang === 'hi' ? 'तत्काल वित्तीय धोखाधड़ी रिपोर्टिंग' : 'Immediate Financial Fraud Reporting'}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {lang === 'hi'
                ? 'अगर धोखे से खाते से पैसे कट चुके हैं, तो गोल्डन ऑवर (शुरुआती 1-2 घंटे) के अंदर कॉल करें। नोडल बैंक अधिकारी फ्रॉड खाते को तुरंत फ्रीज कर सकते हैं।'
                : 'If funds were debited fraudulently, call within the Golden Hour (first 1-2 hours). Nodal bank officers can freeze recipient accounts.'}
            </p>

            <a
              href="tel:1930"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-sm shadow-[0_0_25px_rgba(244,63,94,0.35)] flex items-center justify-center space-x-2 transition-all"
            >
              <PhoneCall className="w-4 h-4 animate-bounce" />
              <span>{lang === 'hi' ? 'कॉल करें: 1930 (टोल-फ्री)' : 'Call 1930 (Toll Free)'}</span>
            </a>

            <div className="p-3.5 bg-black/40 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[11px] font-mono text-slate-400 block uppercase">
                {lang === 'hi' ? 'आधिकारिक पोर्टल' : 'Official Portal'}
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

        {/* Localized Statutory Disclaimer */}
        <footer className="mt-6 pt-3 border-t border-white/5 text-center text-[11px] text-slate-400 space-y-1">
          <p>
            {lang === 'hi'
              ? 'स्वतंत्र सुरक्षा परामर्श उपयोगिता · NPCI, UPI, या किसी भी बैंक से संबद्ध नहीं।'
              : 'Independent Advisory Utility · Not affiliated with NPCI, UPI, or banking institutions.'}
          </p>
          <p>
            {lang === 'hi'
              ? 'यह निष्कर्ष केवल एक ऑन-डिवाइस सुरक्षा अनुमान है और कोई वित्तीय गारंटी नहीं है।'
              : 'Advisory output is a client-side disparity heuristic and not a financial guarantee.'}
          </p>
        </footer>
      </main>

      {/* Floating 3-Tab Bottom Nav Dock */}
      <nav className="fixed bottom-4 inset-x-0 mx-auto w-[92%] max-w-sm bg-slate-900/90 backdrop-blur-2xl border border-white/15 rounded-full p-1.5 flex items-center justify-between shadow-2xl z-40">
        <button
          type="button"
          onClick={() => setActiveTab('scan')}
          className={`flex-1 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'scan' ? 'bg-cyan-400 text-black shadow-lg shadow-cyan-400/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <QrCode className="w-4 h-4 text-inherit" />
          <span>{lang === 'hi' ? 'स्कैनर' : 'Scanner'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('learn')}
          className={`flex-1 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'learn' ? 'bg-cyan-400 text-black shadow-lg shadow-cyan-400/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4 text-inherit" />
          <span>{lang === 'hi' ? 'सीखें' : 'Learn'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('emergency')}
          className={`flex-1 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'emergency' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'text-slate-400 hover:text-rose-400'
          }`}
        >
          <PhoneCall className="w-4 h-4 text-inherit" />
          <span>{lang === 'hi' ? 'हेल्पलाइन' : 'Helpline'}</span>
        </button>
      </nav>
    </div>
  );
}
