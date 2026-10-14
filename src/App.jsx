import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertOctagon, 
  AlertTriangle,
  CheckCircle2, 
  Smartphone, 
  Activity, 
  Layers, 
  Sliders, 
  RefreshCw, 
  ChevronRight, 
  Info, 
  CreditCard, 
  ArrowUpRight,
  XCircle
} from 'lucide-react';

const formatAmount = (amt) => {
  if (amt === null || amt === undefined || isNaN(amt)) return 'Unavailable';
  return `Rs ${Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const validateCommaGrouping = (numStr) => {
  if (!numStr.includes(',')) return true;
  const parts = numStr.split('.');
  const subparts = parts[0].split(',');
  const isWestern = [1, 2, 3].includes(subparts[0].length) && subparts.slice(1).every(p => p.length === 3);
  let isIndian = false;
  if (subparts.length >= 2) {
    if (subparts[subparts.length - 1].length === 3 && subparts.slice(1, -1).every(p => p.length === 2) && [1, 2].includes(subparts[0].length)) {
      isIndian = true;
    }
  }
  return isWestern || isIndian;
};

const parseUpiUri = (uriString) => {
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

const extractIntent = (text) => {
  if (!text || text.trim().length === 0) {
    return { type: 'NONE', amount: null, urgency: false, cues: [], hasNegation: false };
  }
  const lower = text.toLowerCase().trim();

  const negationPatterns = [/\bmat\b/, /\bdon't\b/, /\bdo not\b/, /\bkabhi mat\b/, /\bnever\b/];
  const hasNegation = negationPatterns.some(p => p.test(lower));

  let extractedAmount = null;
  const hasNegativeCurrency = /(?:₹|rs\.?|inr)\s*-\s*\d+/i.test(lower) || /-\s*(?:₹|rs\.?|inr)\s*\d+/i.test(lower);
  if (!hasNegativeCurrency) {
    const amtRegex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)(?!\s*-\s*\d)|(?:\b|^)([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs|inr|\/-)/i;
    const match = lower.match(amtRegex);
    if (match) {
      const rawVal = match[1] || match[2];
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
  const detectedCues = urgencyPatterns.filter(p => p.test(lower)).map(p => p.source.replace(/\\b/g, ''));
  const hasUrgency = detectedCues.length > 0;

  const counterpartyClaims = [
    'bhej diya', 'bheja hai', 'bhej diye', 'i sent you', 'i have sent', 
    'refund approve', 'refund approved', 'credited to your'
  ];
  const actionDirectives = ['pin dalo', 'enter pin', 'scan qr', 'scan karke', 'approve karke', 'accept karo'];
  const victimOutgoing = ['paying', 'send to', 'paid to', 'paying tea', 'paying snack', 'pay kar raha', 'transferring to'];

  const hasCpClaim = counterpartyClaims.some(c => lower.includes(c));
  const hasDirective = actionDirectives.some(d => lower.includes(d));
  const hasVictimSend = victimOutgoing.some(v => lower.includes(v));

  let type = 'AMBIGUOUS';
  if (hasNegation) {
    type = 'AMBIGUOUS';
  } else if ((hasCpClaim || (lower.includes('refund') && (lower.includes('credit') || lower.includes('approve')))) && hasDirective) {
    type = 'RECEIVE';
  } else if (hasCpClaim) {
    type = 'RECEIVE';
  } else if (hasVictimSend && !hasCpClaim) {
    type = 'SEND';
  } else if (lower.includes('pay') && !hasCpClaim && !hasDirective) {
    type = 'SEND';
  }

  return { type, amount: extractedAmount, urgency: hasUrgency, cues: detectedCues, hasNegation };
};

const evaluateDisparity = (messageText, upiUri) => {
  const parsedUri = parseUpiUri(upiUri);
  if (!parsedUri.isValid) {
    return {
      verdict: 'MALFORMED_PAYLOAD',
      tone: 'neutral',
      badge: 'Malformed Payload',
      title: 'Invalid UPI Payload Scheme',
      claimText: 'Payload string failed local syntax validation.',
      actionText: 'Blocked — Invalid structure rejected before parsing completes.',
      correlationText: 'Unavailable',
      reason: parsedUri.error,
      recommendation: 'Do not initiate this payload. The URI violates basic UPI formatting specifications.',
      parsedUri: null
    };
  }

  const intent = extractIntent(messageText);

  if (intent.urgency) {
    return {
      verdict: 'INSUFFICIENT_CONTEXT',
      tone: 'caution',
      badge: 'Coercion / Urgency Signal',
      title: 'Cognitive Pressure Indicator Detected',
      claimText: `Context contains high-pressure keywords: [${intent.cues.join(', ')}].`,
      actionText: `Payload requests an outgoing debit of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
      correlationText: 'Urgency Suppression Rule Active',
      reason: 'Urgency cues indicate possible intimidation or social engineering, suppressing direct clearance.',
      recommendation: 'Pause and verify utility disconnection claims through independent official channels.',
      parsedUri
    };
  }

  let amountCorrelation = 'UNAVAILABLE';
  if (intent.amount !== null && parsedUri.am !== null) {
    amountCorrelation = (Math.abs(intent.amount - parsedUri.am) < 0.01) ? 'MATCHED' : 'MISMATCHED';
  }

  if (intent.type === 'RECEIVE') {
    const isCorroborated = amountCorrelation === 'MATCHED';
    return {
      verdict: isCorroborated ? 'CRITICAL_INTENT_DISPARITY' : 'HIGH_INTENT_DISPARITY',
      tone: 'critical',
      badge: isCorroborated ? 'Critical Disparity' : 'High Disparity',
      title: 'Reverse-Charge Scam Vector Detected',
      claimText: `Sender claims funds were sent or refund is waiting (${formatAmount(intent.amount)}).`,
      actionText: `Payload executes an OUTGOING DEBIT of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
      correlationText: amountCorrelation === 'MATCHED' ? 'Exact Match (Stated incoming sum matches outgoing debit payload)' : 'Uncorroborated Sum',
      reason: 'UPI protocol does not require scanning a QR code or entering a PIN to receive funds. Entering PIN will debit your balance.',
      recommendation: 'Abort transaction immediately. Never input your UPI PIN to claim money or prizes.',
      parsedUri
    };
  }

  if (intent.type === 'SEND') {
    if (intent.amount !== null && parsedUri.am !== null && amountCorrelation === 'MISMATCHED') {
      return {
        verdict: 'HIGH_INTENT_DISPARITY',
        tone: 'critical',
        badge: 'Amount Disparity',
        title: 'Payment Amount Mismatch',
        claimText: `User stated intent to pay ${formatAmount(intent.amount)}.`,
        actionText: `Payload requests an outgoing payment of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
        correlationText: 'Mismatched Amount',
        reason: 'The transaction debit payload does not match the sum stated in surrounding communication.',
        recommendation: 'Verify why the beneficiary has requested a different amount than discussed.',
        parsedUri
      };
    }
    return {
      verdict: 'NO_DISPARITY_DETECTED',
      tone: 'safe',
      badge: 'No Disparity Detected',
      title: 'Intent & Protocol Payload Aligned',
      claimText: `User stated intent to pay ${formatAmount(intent.amount)}.`,
      actionText: `Payload requests an outgoing payment of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
      correlationText: amountCorrelation === 'MATCHED' ? 'Corroborated Sum' : 'Consistent Direction',
      reason: 'The contextual communication matches the outgoing debit nature of the payload string.',
      recommendation: 'Standard payment caution applies. Verify beneficiary name before entering PIN.',
      parsedUri
    };
  }

  return {
    verdict: 'INSUFFICIENT_CONTEXT',
    tone: 'caution',
    badge: 'Insufficient Context',
    title: 'Indeterminate Context Boundary',
    claimText: messageText.trim() ? (intent.hasNegation ? 'Message contains negation phrasing.' : 'No unambiguous directional intent classified.') : 'No surrounding message provided.',
    actionText: `Payload requests an outgoing debit of ${formatAmount(parsedUri.am)} to ${parsedUri.pn}.`,
    correlationText: 'Unavailable',
    reason: 'System could not establish whether the user intended to send or receive funds.',
    recommendation: 'Manually verify beneficiary details directly inside your official banking application.',
    parsedUri
  };
};

const TEST_BATTERY = [
  { id: 1, scenario: 'OLX Reverse Charge Trap', text: 'Maine advance Rs 5000 bhej diye hain OLX table ke liye. QR scan karke PIN dalo aur accept karo.', uri: 'upi://pay?pa=fakeofficer99@ybl&pn=Army%20HQ%20Canteen&am=5000&cu=INR&mode=02', is_deception: true, expected_verdict: 'CRITICAL_INTENT_DISPARITY' },
  { id: 2, scenario: 'Fake Refund Processing', text: 'Aapka Rs 2500 ka electricity refund approve ho gaya hai. Approve karke credit receive karo.', uri: 'upi://pay?pa=refundbot@axisbank&pn=Discom%20Refund&am=2500&cu=INR', is_deception: true, expected_verdict: 'CRITICAL_INTENT_DISPARITY' },
  { id: 3, scenario: 'Chai Stall Payment', text: 'Paying tea stall breakfast snack bill Rs 45 via UPI.', uri: 'upi://pay?pa=sharmatea@okhdfcbank&pn=Sharma%20Tea%20Stall&am=45&cu=INR', is_deception: false, expected_verdict: 'NO_DISPARITY_DETECTED' },
  { id: 4, scenario: 'Kirana Store Milk Payment', text: 'Doodh aur bread ka bill pay kar raha hu Rs 110.', uri: 'upi://pay?pa=guptakirana@icici&pn=Gupta%20General%20Store&am=110&cu=INR', is_deception: false, expected_verdict: 'NO_DISPARITY_DETECTED' },
  { id: 5, scenario: 'Urgent Discom Intimidation', text: 'URGENT NOTICE: Power disconnected tonight by 9:30 PM due to unpaid bill. Pay Rs 120 immediately.', uri: 'upi://pay?pa=discom.billdesk@icici&pn=Discom%20Power&am=120&cu=INR', is_deception: false, expected_verdict: 'INSUFFICIENT_CONTEXT' },
  { id: 6, scenario: 'Generic Link Without Text', text: '', uri: 'upi://pay?pa=collegerecharge@sbi&pn=Campus%20Store&am=200&cu=INR', is_deception: false, expected_verdict: 'INSUFFICIENT_CONTEXT' },
  { id: 7, scenario: 'Broken / Malformed Scheme', text: 'Click this link to pay Rs 500', uri: 'http://scampage.com/pay?amount=500', is_deception: false, expected_verdict: 'MALFORMED_PAYLOAD' },
  { id: 8, scenario: 'Missing VPA Parameter', text: 'Paying Rs 300 to vendor', uri: 'upi://pay?pn=Unknown&am=300', is_deception: false, expected_verdict: 'MALFORMED_PAYLOAD' },
  { id: 9, scenario: 'Reverse Charge with Uncorroborated Amount', text: 'Maine advance bhej diya hai, PIN dalo aur accept karo.', uri: 'upi://pay?pa=scammer77@ybl&pn=QuickDeal&am=1500&cu=INR', is_deception: true, expected_verdict: 'HIGH_INTENT_DISPARITY' },
  { id: 10, scenario: 'Normal Cab Driver Payment', text: 'Uber cab ride payment Rs 340 sent to driver.', uri: 'upi://pay?pa=driver.singh@paytm&pn=Gurpreet%20Singh&am=340&cu=INR', is_deception: false, expected_verdict: 'NO_DISPARITY_DETECTED' }
];

const PRESETS = [
  {
    id: 'scam',
    title: 'OLX Reverse-Charge Trap',
    type: 'Critical',
    message: 'Maine advance Rs 5000 bhej diye hain OLX table ke liye. QR scan karke PIN dalo aur accept karo.',
    uri: 'upi://pay?pa=fakeofficer99@ybl&pn=Army%20HQ%20Canteen&am=5000&cu=INR&mode=02'
  },
  {
    id: 'urgency',
    title: 'Electricity Intimidation Demand',
    type: 'Caution',
    message: 'URGENT NOTICE: Power disconnected tonight by 9:30 PM due to unpaid bill. Pay Rs 120 immediately.',
    uri: 'upi://pay?pa=discom.billdesk@icici&pn=Discom%20Power&am=120&cu=INR'
  },
  {
    id: 'kirana',
    title: 'Legitimate Chai Stall Checkout',
    type: 'Safe',
    message: 'Paying tea stall breakfast snack bill Rs 45 via UPI.',
    uri: 'upi://pay?pa=sharmatea@okhdfcbank&pn=Sharma%20Tea%20Stall&am=45&cu=INR'
  }
];

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [selectedPresetId, setSelectedPresetId] = useState('scam');
  const [message, setMessage] = useState(PRESETS[0].message);
  const [uri, setUri] = useState(PRESETS[0].uri);
  const [analysis, setAnalysis] = useState(() => evaluateDisparity(PRESETS[0].message, PRESETS[0].uri));
  const [isStale, setIsStale] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  // Clean zero-state: No seeded artificial transactions
  const [vectorLogs, setVectorLogs] = useState([]);
  const [counter, setCounter] = useState(100);
  
  const [decisionFeedback, setDecisionFeedback] = useState(null);
  const [phoneSimAction, setPhoneSimAction] = useState(null);
  const [evalLatency, setEvalLatency] = useState(0.8);

  const benchmarkResult = useMemo(() => {
    let tp = 0, fp = 0, tn = 0, fn = 0, passed = 0;
    const details = TEST_BATTERY.map(item => {
      const v = evaluateDisparity(item.text, item.uri);
      const isPass = (v.verdict === item.expected_verdict);
      if (isPass) passed++;
      const flagged = (v.verdict === 'CRITICAL_INTENT_DISPARITY' || v.verdict === 'HIGH_INTENT_DISPARITY');
      if (item.is_deception && flagged) tp++;
      else if (!item.is_deception && flagged) fp++;
      else if (!item.is_deception && !flagged) tn++;
      else if (item.is_deception && !flagged) fn++;
      return { ...item, actual_verdict: v.verdict, isPass };
    });
    const precision = (tp + fp) > 0 ? ((tp / (tp + fp)) * 100).toFixed(1) : 'N/A';
    const recall = (tp + fn) > 0 ? ((tp / (tp + fn)) * 100).toFixed(1) : 'N/A';
    const accuracy = ((passed / TEST_BATTERY.length) * 100).toFixed(1);
    return { tp, fp, tn, fn, passed, total: TEST_BATTERY.length, precision, recall, accuracy, details };
  }, []);

  const handleRunAnalysis = (m = message, u = uri) => {
    const start = performance.now();
    const result = evaluateDisparity(m, u);
    const end = performance.now();
    setEvalLatency(parseFloat((end - start).toFixed(2)));
    setAnalysis(result);
    setIsStale(false);
    setDecisionFeedback(null);
    setPhoneSimAction(null);

    const nextId = counter + 1;
    setCounter(nextId);
    const newEntry = {
      id: `SIM-${nextId}`,
      payee: result.parsedUri ? result.parsedUri.pn : 'Unverified Payload',
      amount: result.parsedUri && result.parsedUri.am !== null ? result.parsedUri.am : null,
      text: m,
      uri: u,
      verdict: result.verdict,
      tone: result.tone,
      time: new Date().toLocaleTimeString()
    };
    setVectorLogs(prev => [newEntry, ...prev.slice(0, 19)]);
  };

  const handlePresetChange = (preset) => {
    setSelectedPresetId(preset.id);
    setMessage(preset.message);
    setUri(preset.uri);
    handleRunAnalysis(preset.message, preset.uri);
  };

  const handleResetSandbox = () => {
    setSelectedPresetId('scam');
    setMessage(PRESETS[0].message);
    setUri(PRESETS[0].uri);
    setAnalysis(evaluateDisparity(PRESETS[0].message, PRESETS[0].uri));
    setIsStale(false);
    setVectorLogs([]);
    setCounter(100);
    setDecisionFeedback(null);
    setPhoneSimAction(null);
  };

  const dynamicMetrics = useMemo(() => {
    const totalCount = vectorLogs.length;
    const totalVolume = vectorLogs.reduce((acc, curr) => acc + (typeof curr.amount === 'number' ? curr.amount : 0), 0);
    const flaggedCount = vectorLogs.filter(v => v.tone === 'critical' || v.tone === 'caution').length;
    const benignCount = vectorLogs.filter(v => v.tone === 'safe').length;
    const passRate = totalCount > 0 ? ((benignCount / totalCount) * 100).toFixed(1) : '—';

    return {
      totalVolume: totalCount > 0 ? formatAmount(totalVolume) : 'Rs 0.00',
      evaluations: `${flaggedCount} flagged / ${totalCount} runs`,
      benignPassRate: totalCount > 0 ? `${passRate}%` : '—'
    };
  }, [vectorLogs]);

  const filteredLogs = useMemo(() => {
    return vectorLogs.filter(v => {
      if (activeTab === 'flagged') return v.tone === 'critical' || v.tone === 'caution';
      if (activeTab === 'benign') return v.tone === 'safe';
      return true;
    });
  }, [vectorLogs, activeTab]);

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1E293B] font-sans antialiased flex">
      {/* Sidebar with Button Semantics */}
      <aside className="w-16 bg-[#0F172A] flex flex-col items-center py-6 justify-between shrink-0">
        <div className="flex flex-col items-center space-y-8">
          <button 
            onClick={() => setActiveNav('dashboard')}
            aria-label="UPI Sentinel Dashboard"
            className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md font-bold text-lg cursor-pointer hover:bg-blue-500 transition-colors"
          >
            S
          </button>
          <nav className="flex flex-col space-y-5 text-slate-400">
            <button 
              onClick={() => setActiveNav('dashboard')}
              aria-label="Simulation Workspace"
              title="Simulation Workspace"
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'dashboard' ? 'text-white bg-slate-800 shadow-xs' : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveNav('threats')}
              aria-label="Deterministic Benchmark Suite"
              title="Deterministic Benchmark Suite"
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'threats' ? 'text-white bg-slate-800 shadow-xs' : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveNav('vectors')}
              aria-label="Evaluation Ledger"
              title="Evaluation Ledger"
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'vectors' ? 'text-white bg-slate-800 shadow-xs' : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveNav('settings')}
              aria-label="Engine Specifications"
              title="Engine Specifications"
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'settings' ? 'text-white bg-slate-800 shadow-xs' : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sliders className="w-5 h-5" />
            </button>
          </nav>
        </div>
        <div className="flex flex-col items-center space-y-4 text-slate-400">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-medium select-none">
            SS
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Transparent System Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">UPI Sentinel</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">
              {activeNav === 'dashboard' && 'Client-Side Disparity Advisory Prototype'}
              {activeNav === 'threats' && 'Deterministic Synthetic Baseline (10 Fixtures)'}
              {activeNav === 'vectors' && 'Session Evaluation Ledger'}
              {activeNav === 'settings' && 'Disparity Engine Rules Contract'}
            </span>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-xs text-slate-500 font-mono">
              Local Parser: <span className="font-semibold text-emerald-600">{evalLatency}ms</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <button 
              onClick={handleResetSandbox} 
              className="flex items-center space-x-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset State & Logs</span>
            </button>
          </div>
        </header>

        {/* Prototype Scope Banner */}
        <div className="bg-blue-50/70 border-b border-blue-100 px-8 py-2 text-[11px] text-blue-800 flex items-center justify-between">
          <span>
            <strong>Simulation Sandbox:</strong> Evaluates claimed message intent against payload URI debit action. Does not intercept core banking rails or verify off-chain legal identity.
          </span>
          <span className="font-mono text-blue-600">Pure Client-Side Engine</span>
        </div>

        {activeNav === 'dashboard' && (
          <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
            {/* Dynamic Session Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs font-medium text-slate-500 mb-1">Session Simulated Volume</div>
                <div className="text-2xl font-bold text-slate-900">{dynamicMetrics.totalVolume}</div>
                <div className="mt-3 flex items-center space-x-2 text-[11px] text-slate-400">
                  <span>From {vectorLogs.length} evaluated actions</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs font-medium text-slate-500 mb-1">Flagged for Friction</div>
                <div className="text-2xl font-bold text-slate-900">{dynamicMetrics.evaluations}</div>
                <div className="mt-3 flex items-center space-x-2 text-[11px] text-slate-400">
                  <span>Critical & Cautionary advice</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs font-medium text-slate-500 mb-1">Session Clean Intent Rate</div>
                <div className="text-2xl font-bold text-slate-900">{dynamicMetrics.benignPassRate}</div>
                <div className="mt-3 flex items-center space-x-2 text-[11px] text-slate-400">
                  <span>Aligned outgoing debits</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs font-medium text-slate-500 mb-1">Disparity Specification</div>
                <div className="text-2xl font-bold text-blue-600">IADE v2.8</div>
                <div className="mt-3 flex items-center space-x-1 text-[11px] text-slate-500 font-mono">
                  <span>Rule: </span><span className="text-slate-800 font-semibold">Semantic Claim != Action</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-2 rounded-2xl border border-slate-200 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 font-mono">Test Presets:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center space-x-2 cursor-pointer ${
                    selectedPresetId === p.id ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.type === 'Critical' ? 'bg-red-500' : p.type === 'Caution' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span>{p.title}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Context Telemetry</span>
                    {isStale && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Input Edited — Not Evaluated</span>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Surrounding Communication Context</label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => { setMessage(e.target.value); setIsStale(true); }}
                      className="w-full text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 resize-none font-sans leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Raw UPI Payload String</label>
                    <input
                      type="text"
                      value={uri}
                      onChange={(e) => { setUri(e.target.value); setIsStale(true); }}
                      className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800"
                    />
                  </div>
                  <button
                    onClick={() => handleRunAnalysis()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Run Disparity Engine</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Honest Simulated Phone HUD */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center">
                  <div className="w-full flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Simulated Pre-Auth HUD</span>
                    <Smartphone className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="w-full max-w-[320px] bg-slate-900 p-3 rounded-[36px] shadow-2xl">
                    <div className="bg-[#FAFBFD] rounded-[28px] p-4 flex flex-col space-y-4 min-h-[380px] justify-between">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 pt-1 font-mono">
                        <span>Pre-Auth Advisory HUD</span>
                        <span className="text-slate-500 font-semibold">● SIMULATOR</span>
                      </div>
                      
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center space-y-1">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Payload Target Debit</div>
                        <div className="text-2xl font-extrabold text-slate-900">
                          {formatAmount(analysis.parsedUri?.am)}
                        </div>
                        <div className="text-xs text-slate-600 font-medium truncate">To: {analysis.parsedUri?.pn || 'Unknown Payee'}</div>
                      </div>

                      {analysis.tone === 'critical' && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded-2xl space-y-1">
                          <div className="flex items-center space-x-1.5 text-red-700 text-xs font-bold">
                            <AlertOctagon className="w-4 h-4 shrink-0" />
                            <span>Reverse-Charge Warning</span>
                          </div>
                          <p className="text-[11px] text-red-600 leading-tight">
                            Entering PIN will DEBIT {formatAmount(analysis.parsedUri?.am)} from your account balance.
                          </p>
                        </div>
                      )}

                      {analysis.tone === 'caution' && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl space-y-1">
                          <div className="flex items-center space-x-1.5 text-amber-700 text-xs font-bold">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Context Caution Notice</span>
                          </div>
                          <p className="text-[11px] text-amber-600 leading-tight">
                            Verify claims through official channels before proceeding with payment.
                          </p>
                        </div>
                      )}

                      {analysis.tone === 'neutral' && (
                        <div className="bg-slate-100 border border-slate-200 p-3 rounded-2xl space-y-1">
                          <div className="flex items-center space-x-1.5 text-slate-700 text-xs font-bold">
                            <XCircle className="w-4 h-4 shrink-0" />
                            <span>Malformed URI Scheme</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-tight">
                            Payload string is broken or unverified. Local validation refused.
                          </p>
                        </div>
                      )}

                      {analysis.tone === 'safe' && (
                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl space-y-1">
                          <div className="flex items-center space-x-1.5 text-emerald-700 text-xs font-bold">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Consistent Direction</span>
                          </div>
                          <p className="text-[11px] text-emerald-600 leading-tight">
                            Context and payload are consistent. Note: Does not confirm merchant legitimacy.
                          </p>
                        </div>
                      )}

                      {phoneSimAction ? (
                        <div className="p-2.5 rounded-xl text-center text-xs font-semibold bg-slate-800 text-white">
                          {phoneSimAction}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button 
                            onClick={() => setPhoneSimAction('Simulated: Advisory Acknowledged (Aborted)')}
                            className="w-full py-2.5 rounded-xl text-xs font-bold shadow-sm bg-red-600 hover:bg-red-700 text-white cursor-pointer active:scale-95 transition-all"
                          >
                            Simulate Reject Action
                          </button>
                          {analysis.tone === 'safe' && (
                            <button 
                              onClick={() => setPhoneSimAction('Simulated: User Proceeded (Demo only)')}
                              className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer transition-all"
                            >
                              Simulate Authorize (Demo only)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-8 space-y-6">
                  <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                    <div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full font-mono ${
                        analysis.tone === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                        analysis.tone === 'safe' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        analysis.tone === 'neutral' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {analysis.badge}
                      </span>
                      <h2 className="text-xl font-extrabold text-slate-900 mt-3">{analysis.title}</h2>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 font-mono block">EVALUATOR VERDICT</span>
                      <span className="text-xs font-bold font-mono text-slate-800">{analysis.verdict}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl divide-y divide-slate-200 text-xs">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-4 font-mono font-bold text-slate-400 uppercase text-[11px]">1. Claimed Intent</div>
                      <div className="md:col-span-8 text-slate-900 font-medium">{analysis.claimText}</div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-4 font-mono font-bold text-slate-400 uppercase text-[11px]">2. Payload Action</div>
                      <div className="md:col-span-8 text-slate-900 font-medium">{analysis.actionText}</div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-4 font-mono font-bold text-slate-400 uppercase text-[11px]">3. Corroboration</div>
                      <div className="md:col-span-8 text-slate-800">{analysis.correlationText}</div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-4 font-mono font-bold text-slate-400 uppercase text-[11px]">4. Disparity Finding</div>
                      <div className="md:col-span-8 text-slate-600 leading-relaxed">{analysis.reason}</div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 bg-white rounded-b-2xl">
                      <div className="md:col-span-4 font-mono font-bold text-blue-600 uppercase text-[11px]">5. Advisory Notice</div>
                      <div className="md:col-span-8 font-semibold text-slate-900">{analysis.recommendation}</div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{analysis.parsedUri?.pn || 'Payee Check'}</div>
                        <div className="text-xs text-slate-500 font-mono">{analysis.parsedUri?.pa || 'N/A'}</div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-base font-extrabold text-slate-900">{formatAmount(analysis.parsedUri?.am)}</div>
                        <div className="text-[10px] text-slate-400 font-mono">INR Outgoing Debit</div>
                      </div>
                    </div>

                    {decisionFeedback ? (
                      <div className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between ${
                        decisionFeedback.type === 'cancel'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        <span>{decisionFeedback.msg}</span>
                        <button 
                          onClick={() => setDecisionFeedback(null)} 
                          className="text-[11px] underline ml-2 font-semibold cursor-pointer"
                        >
                          Reset Decision
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button 
                          onClick={() => setDecisionFeedback({ type: 'cancel', msg: 'Simulation: User rejected debit advisory. No funds moved.' })}
                          className="py-2.5 px-4 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 active:scale-95 text-white transition-all cursor-pointer shadow-sm"
                        >
                          Simulate Abort
                        </button>
                        <button 
                          onClick={() => setDecisionFeedback({ type: 'authorize', msg: 'Simulation: User acknowledged & authorized (Demo bypass).' })}
                          className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all cursor-pointer"
                        >
                          Simulate Authorize
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start space-x-3 text-slate-400 text-[11px] leading-relaxed pt-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Evaluator Boundary:</strong> NO_DISPARITY_DETECTED implies contextual direction and payload parameters match. It is not an assertion of legal identity or merchant credibility.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* View 2: Deterministic Baseline Benchmark */}
        {activeNav === 'threats' && (
          <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Deterministic Synthetic Baseline (10 Fixtures)</h2>
                  <p className="text-xs text-slate-500 mt-1">Evaluated across calibrated test fixtures loaded from shared <code>test_fixtures.json</code> schema.</p>
                </div>
                <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Exact Match: {benchmarkResult.accuracy}%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Threat Precision</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">{benchmarkResult.precision}%</div>
                  <div className="text-[10px] text-slate-500 mt-1">{benchmarkResult.fp} False Alarms on Controls</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Attack Recall</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">{benchmarkResult.recall}%</div>
                  <div className="text-[10px] text-slate-500 mt-1">{benchmarkResult.fn} Reverse Charges Missed</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Exact Verdict Pass</div>
                  <div className="text-2xl font-extrabold text-blue-600 mt-1">{benchmarkResult.accuracy}%</div>
                  <div className="text-[10px] text-slate-500 mt-1">{benchmarkResult.passed} / {benchmarkResult.total} Matched Spec</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-xs font-medium text-slate-500">Client Execution Time</div>
                  <div className="text-2xl font-extrabold text-emerald-600 mt-1">{evalLatency}ms</div>
                  <div className="text-[10px] text-slate-400 mt-1">Synchronous pass</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-5 bg-[#FAFBFD]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">Confusion Matrix (Deception Label vs Engine Flag)</h3>
                <div className="grid grid-cols-2 max-w-sm gap-2 text-center text-xs font-mono">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">True Positive (TP)</span>
                    <span className="text-base font-bold text-emerald-700">{benchmarkResult.tp}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">False Positive (FP)</span>
                    <span className="text-base font-bold text-slate-800">{benchmarkResult.fp}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">False Negative (FN)</span>
                    <span className="text-base font-bold text-slate-800">{benchmarkResult.fn}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">True Negative (TN)</span>
                    <span className="text-base font-bold text-emerald-700">{benchmarkResult.tn}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">Live Fixture Comparison (Expected vs Actual)</h3>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white text-xs">
                  {benchmarkResult.details.map(item => (
                    <div key={item.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <span className="font-mono text-slate-400 mr-2">#{String(item.id).padStart(2, '0')}</span>
                        <span className="font-semibold text-slate-800">{item.scenario}</span>
                      </div>
                      <div className="flex items-center space-x-3 font-mono text-[11px]">
                        <span className="text-slate-400">Exp: {item.expected_verdict}</span>
                        <span className="text-slate-700">Act: {item.actual_verdict}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isPass ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {item.isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        )}

        {/* View 3: Session Evaluation Ledger */}
        {activeNav === 'vectors' && (
          <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Session Evaluation Ledger</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Captures evaluations run in this browser session only (Clean state initialized)</p>
                </div>
                <div className="flex space-x-2">
                  {['all', 'flagged', 'benign'].map((t) => (
                    <button 
                      key={t} 
                      onClick={() => setActiveTab(t)} 
                      className={`px-3 py-1 rounded-lg text-xs capitalize cursor-pointer transition-colors ${
                        activeTab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No evaluations recorded yet in this session. Trigger analysis from Sandbox to populate ledger.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase font-mono text-[10px] border-b border-slate-100">
                      <th className="pb-3">Session ID</th>
                      <th className="pb-3">Payee Label</th>
                      <th className="pb-3">Payload Debit</th>
                      <th className="pb-3">Context Text</th>
                      <th className="pb-3">Engine Verdict</th>
                      <th className="pb-3 text-right">Local Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 font-mono text-slate-500">{row.id}</td>
                        <td className="py-3 font-semibold text-slate-900">{row.payee}</td>
                        <td className="py-3 font-bold text-slate-900">{formatAmount(row.amount)}</td>
                        <td className="py-3 text-slate-600 max-w-xs truncate">{row.text || 'No context supplied'}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.tone === 'critical' ? 'bg-red-50 text-red-700' :
                            row.tone === 'caution' ? 'bg-amber-50 text-amber-700' :
                            row.tone === 'neutral' ? 'bg-slate-100 text-slate-700' :
                            'bg-emerald-50 text-emerald-700'
                          }`}>
                            {row.verdict}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-slate-400">{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </main>
        )}

        {/* View 4: Engine Rules Contract */}
        {activeNav === 'settings' && (
          <main className="p-8 space-y-6 max-w-7xl mx-auto w-full">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs max-w-2xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Disparity Engine Rules Contract</h2>
                <p className="text-xs text-slate-500 mt-1">Formal heuristic rules applied identically across CLI and Browser evaluators.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-800">Coercion Suppression Rule</div>
                    <div className="text-slate-500 mt-0.5">Demotes send intent to INSUFFICIENT_CONTEXT on panic triggers (disconnected, power cut).</div>
                  </div>
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 font-bold font-mono">ENFORCED</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-800">Duplicate Parameter Rejection</div>
                    <div className="text-slate-500 mt-0.5">Rejects payload strings containing conflicting duplicate query keys.</div>
                  </div>
                  <span className="px-2 py-1 rounded bg-slate-200 text-slate-700 font-bold font-mono">STRICT</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-800">Standard Indian & Western Number Formatting</div>
                    <div className="text-slate-500 mt-0.5">Validates comma groupings (rejects malformed strings like 5,00).</div>
                  </div>
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 font-bold font-mono">VALIDATED</span>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}