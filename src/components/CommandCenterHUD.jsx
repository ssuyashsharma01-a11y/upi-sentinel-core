import { useMemo, useRef, useState, useEffect } from "react";
import {
  Activity, AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight,
  Camera, ChevronRight, ClipboardCheck, Download,
  FileSearch, Fingerprint, Gauge, GitBranch, LockKeyhole, Play, QrCode, Radar,
  RefreshCw, Shield, ShieldAlert, ShieldCheck, Terminal, Upload, WalletCards, X, Sparkles, ArrowRight, HelpCircle
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import "./CommandCenterHUD.css";

const API_URL = "http://localhost:8000/api/verify-transaction";

const SCENARIOS = {
  reverse: {
    label: "Reverse-charge scam",
    type: "CRITICAL",
    action: "RECEIVE",
    message: 'Buyer: "Maine ₹5,000 bhej diye — QR scan karke PIN enter karo."',
    uri: "upi://pay?pa=demo.receiver@upi&pn=Demo%20Store&am=5000&cu=INR&mode=02",
    note: "Message suggests receiving money, while the URI requests a payment."
  },
  legitimate: {
    label: "Legitimate merchant",
    type: "SAFE",
    action: "SEND",
    message: "Pay ₹40 for chai and snacks at the counter.",
    uri: "upi://pay?pa=chai.demo@okhdfcbank&pn=Demo%20Chai%20Stall&am=40&cu=INR",
    note: "A demo payment scenario. The merchant identity is not independently verified."
  },
  malformed: {
    label: "Malformed or invalid URI",
    type: "CAUTION",
    action: "RECEIVE",
    message: "Suspicious structure test case.",
    uri: "http://malicious-website.com/pay?pa=",
    note: "Tests strict validation rules for malformed payloads."
  },
  unicode: {
    label: "Unicode / Homograph spoof",
    type: "CRITICAL",
    action: "SEND",
    message: "Please pay the invoice using the attached official bank request.",
    uri: "upi://pay?pa=pmkisan.sb\u0456@ybl&pn=Invoice&am=1250&cu=INR&note=%E2%80%8B",
    note: "Contains Cyrillic homograph character and zero-width space."
  }
};

const timeNow = () => new Date().toLocaleTimeString([], { hour12: false });

function validateUpiUri(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "upi:" || parsed.hostname !== "pay") {
      return "Unsupported URI. Expected a upi://pay request.";
    }
    if (!parsed.searchParams.get("pa")) {
      return "Missing payee address (pa).";
    }
    const amount = parsed.searchParams.get("am");
    if (amount !== null && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
      return "Invalid payment amount.";
    }
    return null;
  } catch {
    return "Malformed URI. Please check the scanned or pasted payload.";
  }
}

function parseUriPreview(uri) {
  const validationError = validateUpiUri(uri);
  if (validationError) {
    return { payee: "Invalid URI", name: "Invalid URI", amount: "Unknown", currency: "Unknown", anomalies: [validationError] };
  }
  try {
    const parsed = new URL(uri);
    const p = parsed.searchParams;
    const anomalies = [];
    for (let i = 0; i < uri.length; i++) {
      if (uri.charCodeAt(i) > 127) {
        anomalies.push(`Non-ASCII byte detected at pos ${i}`);
      }
    }
    if (uri.includes("%E2%80%8B") || uri.includes("\u200B")) {
      anomalies.push("Hidden Zero-Width Space (U+200B) parameter smuggling detected");
    }
    return {
      payee: p.get("pa") || "Not specified",
      name: p.get("pn") || "Not specified",
      amount: p.get("am") ? `₹${p.get("am")}` : "Variable / not specified",
      currency: p.get("cu") || "Not specified",
      anomalies
    };
  } catch {
    return { payee: "Could not parse", name: "Could not parse", amount: "Unknown", currency: "Unknown", anomalies: ["Parsing failed"] };
  }
}

function calculateWeightedBreakdown(uri, action, message, preview) {
  let score = 10;
  const breakdown = [];
  const msgLower = message.toLowerCase();

  const receiveKeywords = ["receive", "refund", "cashback", "prize", "credited", "claim", "get money", "bhej diya", "bhejdiya", "bheja", "won"];
  const hasReceiveIntent = receiveKeywords.some(kw => msgLower.includes(kw));
  const isReceiveClaim = action === "RECEIVE" || hasReceiveIntent;
  const hasDebitMode = uri.includes("mode=02") || uri.includes("am=");

  if (isReceiveClaim && hasDebitMode) {
    score += 50;
    breakdown.push({ label: "Intent Contradiction (Receive vs Debit)", weight: "+50" });
  }

  if (preview.anomalies.length > 0) {
    score += 30;
    breakdown.push({ label: "Byte X-Ray / Hidden Characters", weight: "+30" });
  }

  const urgentWords = ["suspended", "police", "immediately", "arrest", "block", "kyc"];
  if (urgentWords.some(w => msgLower.includes(w))) {
    score += 15;
    breakdown.push({ label: "Coercion & Urgency Cues", weight: "+15" });
  }

  const restrictedTerms = /\b(rbi|rto|army|kbc|cyber cell)\b/i;
  if (restrictedTerms.test(msgLower) || restrictedTerms.test(uri)) {
    score += 20;
    breakdown.push({ label: "Authoritative Impersonation", weight: "+20" });
  }

  const finalScore = Math.min(100, Math.max(score, 15));
  return { finalScore, breakdown };
}

function buildLocalFallback(uri, action, message, preview) {
  const validationErr = validateUpiUri(uri.trim());
  if (validationErr) {
    return {
      risk_score: 0,
      risk_level: "INVALID_INPUT",
      warning_title: "Malformed or Unsupported URI",
      reasons: [validationErr],
      action_advice: "Please correct the URI format before running inspection.",
      breakdown: []
    };
  }

  const { finalScore, breakdown } = calculateWeightedBreakdown(uri, action, message, preview);
  const reasons = [];

  breakdown.forEach(b => reasons.push(`${b.label} [Weight: ${b.weight}]`));
  if (preview.anomalies.length > 0) {
    preview.anomalies.forEach(a => reasons.push(`BYTE X-RAY: ${a}`));
  }
  if (reasons.length === 0) {
    reasons.push("Intent aligns with standard payload parameters. No severe anomalies found.");
  }

  const level = finalScore >= 70 ? "HIGH_RISK" : finalScore >= 35 ? "CAUTION" : "LOW_RISK";
  const title = finalScore >= 70 ? "High Risk Disparity Detected" : finalScore >= 35 ? "Moderate Context Caution" : "Structure Clean";

  return {
    risk_score: finalScore,
    risk_level: level,
    warning_title: title,
    reasons,
    breakdown,
    action_advice: finalScore >= 70 ? "STOP: Do not enter your UPI PIN. Verify request details independently." : "Proceed with standard user caution."
  };
}

function riskStyle(level, score) {
  if (level.includes("HIGH") || level.includes("CRITICAL") || (score ?? 0) >= 70) return "critical";
  if (level.includes("CAUTION") || level.includes("MEDIUM") || (score ?? 0) >= 35) return "caution";
  if (level.includes("LOW") || level.includes("SAFE") || level.includes("CLEAN")) return "safe";
  return "unknown";
}

function Metric({ label, value, icon: Icon, tone = "neutral" }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-top"><span>{label}</span><Icon size={16} /></div>
      <strong>{value}</strong>
    </div>
  );
}

export default function CommandCenterHUD() {
  const [action, setAction] = useState("RECEIVE");
  const [uri, setUri] = useState(SCENARIOS.reverse.uri);
  const [message, setMessage] = useState(SCENARIOS.reverse.message);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scanningCamera, setScanningCamera] = useState(false);
  const [frictionText, setFrictionText] = useState("");
  const [engineSource, setEngineSource] = useState(""); 
  const [logs, setLogs] = useState([
    { time: timeNow(), kind: "SYSTEM", text: "UPI Sentinel interface initialized safely." },
    { time: timeNow(), kind: "INFO", text: "Scam X-Ray & Weighted Scoring Active." }
  ]);
  const [activeScenario, setActiveScenario] = useState("reverse");
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(1);

  const fileInputRef = useRef(null);
  const scannerRef = useRef(null);

  const preview = useMemo(() => parseUriPreview(uri), [uri]);
  const style = result ? riskStyle(result.risk_level, result.risk_score) : "unknown";
  const score = result?.risk_score;
  const addLog = (kind, text) => setLogs(prev => [{ time: timeNow(), kind, text }, ...prev].slice(0, 8));

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const playAlertTone = (toneStyle) => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = toneStyle === "critical" ? "sawtooth" : "sine";
        osc.frequency.value = toneStyle === "critical" ? 720 : 520;
        gain.gain.value = 0.03;
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.18);
        osc.onended = () => ctx.close();
      }
    } catch { /* ignore */ }
  };

  const loadScenario = (key) => {
    const s = SCENARIOS[key];
    setActiveScenario(key);
    setAction(s.action);
    setMessage(s.message);
    setUri(s.uri);
    setResult(null);
    setError("");
    setFrictionText("");
    setEngineSource("");
    addLog("TEST LAB", `Loaded case: ${s.label}`);
    if (tourActive && tourStep === 1) setTourStep(2);
  };

  const handleQrFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addLog("INSPECT", `Decoding QR image: ${file.name}`);
    try {
      const html5QrCode = new Html5Qrcode("qr-hidden-reader");
      const decodedText = await html5QrCode.scanFile(file, true);
      setUri(decodedText);
      setError("");
      addLog("RESULT", `Decoded QR payload successfully.`);
    } catch {
      setError("Could not decode a valid QR code from the selected image.");
      addLog("ERROR", "QR image decode failed.");
    }
  };

  const toggleCamera = async () => {
    if (scanningCamera) {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      setScanningCamera(false);
      addLog("INFO", "Camera scanner stopped.");
    } else {
      setScanningCamera(true);
      addLog("INSPECT", "Starting optical QR scanner...");
      setTimeout(async () => {
        try {
          if (!document.getElementById("live-camera-box")) return;
          const qr = new Html5Qrcode("live-camera-box");
          scannerRef.current = qr;
          await qr.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 180, height: 180 } },
            (decoded) => {
              setUri(decoded);
              addLog("RESULT", "QR captured from live camera.");
              qr.stop().catch(() => {});
              scannerRef.current = null;
              setScanningCamera(false);
            },
            () => {}
          );
        } catch {
          setError("Camera access denied or unmounted prematurely.");
          setScanningCamera(false);
        }
      }, 250);
    }
  };

  async function inspect() {
    const validationError = validateUpiUri(uri.trim());
    if (validationError) {
      setError(validationError);
      addLog("VALIDATION", validationError);
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    setFrictionText("");
    setEngineSource("");
    addLog("INSPECT", "Submitting payload with weighted scoring engine...");

    try {
      const fallback = buildLocalFallback(uri.trim(), action, message.trim(), preview);
      setResult(fallback);
      setEngineSource("WEIGHTED HEURISTIC ENGINE");
      playAlertTone(riskStyle(fallback.risk_level, fallback.risk_score));
      addLog("RESULT", `Evaluated via Weighted Engine · score ${fallback.risk_score}/100.`);
    } catch (err) {
      setError("Inspection failed: " + err.message);
    } finally {
      setBusy(false);
      if (tourActive && tourStep === 3) setTourStep(4);
    }
  }

  const handleGuidedInspect = () => {
    if (tourActive && tourStep === 2) setTourStep(3);
    inspect();
  };

  function exportReport() {
    if (!result) return;
    const report = {
      product: "UPI Sentinel (KavachAI)",
      engine_source: engineSource,
      report_type: "weighted_advisory_inspection",
      generated_at: new Date().toISOString(),
      input: { claimed_action: action, context_message: message, upi_uri: uri },
      evaluation: result,
      activity_log: logs
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `upi-sentinel-weighted-report-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    addLog("EXPORT", "Weighted advisory incident JSON summary exported.");
  }

  return (
    <main className="sentinel-app">
      <div id="qr-hidden-reader" style={{ display: "none" }} />
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />

      {tourActive && (
        <div className="tour-overlay-banner">
          <div className="tour-content">
            <div className="tour-step-indicator">MISSION 01 // STEP {tourStep} OF 4</div>
            <div className="tour-instruction">
              {tourStep === 1 && "Step 1: Test Lab se 'Reverse-charge scam' case select karein."}
              {tourStep === 2 && "Step 2: Case load ho chuka hai. Ab green 'Inspect Payment Intent' button par click karein."}
              {tourStep === 3 && "Step 3: Weighted evaluation chal rahi hai..."}
              {tourStep === 4 && "Step 4: Scam X-Ray aur Weighted Breakdown check karein! Mission Complete."}
            </div>
          </div>
          <div className="tour-actions">
            <button onClick={() => setTourActive(false)} className="tour-skip-btn">Exit Tour</button>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Shield size={23} /></div>
          <div><div className="brand-name">UPI<span> SENTINEL</span></div><div className="brand-sub">KAVACH-AI // WEIGHTED THREAT CONSOLE</div></div>
        </div>
        <div className="topbar-right">
          <button onClick={() => { setTourActive(true); setTourStep(1); loadScenario('reverse'); }} className="tour-launch-btn">
            <Sparkles size={14} /> Guided Mission
          </button>
          <span className="status-pill"><span className="status-dot" /> {engineSource ? engineSource : "ENGINE READY"}</span>
          <span className="privacy-pill"><LockKeyhole size={13} /> ZERO-TRUST LOCAL DESIGN</span>
          <button className={`icon-button ${soundEnabled ? "icon-active" : ""}`} title="Toggle sound alert" onClick={() => setSoundEnabled(v => !v)} aria-label="Toggle sound alert">
            <Activity size={17} />
          </button>
        </div>
      </header>

      <section className="hero-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> SCAM X-RAY / WEIGHTED ANALYSIS</div>
          <h1>Security <span>Command Center</span></h1>
          <p>Inspect intent and structural validity with weighted signal breakdown.</p>
        </div>
        <div className="hero-badge"><Radar size={18} /><div><strong>X-RAY MODE</strong><small>Signal Weighting · Advisory Layer</small></div></div>
      </section>

      <section className="metrics-grid">
        <Metric label="Inspection engine" value={busy ? "Processing…" : engineSource ? `Active` : "Ready"} icon={Activity} tone="green" />
        <Metric label="URI structure" value={preview.anomalies.length ? `${preview.anomalies.length} Flag` : "Valid & Clean"} icon={QrCode} tone={preview.anomalies.length ? "red" : "green"} />
        <Metric label="Latest assessment" value={result ? result.risk_level.replaceAll("_", " ") : "Not run yet"} icon={Gauge} tone={style === "critical" ? "red" : style === "caution" ? "amber" : "neutral"} />
        <Metric label="Advisory Dossier" value={result ? "Ready for Export" : "No report yet"} icon={FileSearch} />
      </section>

      <div className="main-grid">
        <section className="left-column">
          <div className={`panel ${tourActive && tourStep === 1 ? "spotlight-pulse" : ""}`}>
            <div className="panel-heading">
              <div className="panel-icon purple"><ClipboardCheck size={18} /></div>
              <div><h2>Interactive Test Lab</h2><p>Load predefined scenarios to test weighted heuristics.</p></div>
              <span className="section-count">04 CASES</span>
            </div>
            <div className="scenario-grid">
              {Object.entries(SCENARIOS).map(([key, scenario]) => (
                <button key={key} className={`scenario-card scenario-${scenario.type.toLowerCase()} ${activeScenario === key ? "scenario-selected" : ""}`} onClick={() => loadScenario(key)}>
                  <span className="scenario-icon">{scenario.type === "CRITICAL" ? <AlertOctagon size={17} /> : scenario.type === "SAFE" ? <ShieldCheck size={17} /> : <HelpCircle size={17} />}</span>
                  <span className="scenario-label">{scenario.label}</span>
                  <span className="scenario-note">{scenario.note}</span>
                  <span className="scenario-open">Load case <ChevronRight size={13} /></span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel input-panel">
            <div className="panel-heading">
              <div className="panel-icon green"><Terminal size={18} /></div>
              <div><h2>QR Shield & Payload Inspection</h2><p>Scan a QR frame or evaluate URI parameters safely.</p></div>
            </div>

            <label className="field-label">OPTICAL QR SHIELD INGESTION</label>
            <div className="qr-toolbar">
              <input type="file" ref={fileInputRef} onChange={handleQrFileUpload} accept="image/*" style={{ display: "none" }} />
              <button type="button" className="qr-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={15} /> Upload QR Image
              </button>
              <button type="button" className={`qr-btn ${scanningCamera ? "camera-active" : ""}`} onClick={toggleCamera}>
                {scanningCamera ? <><X size={15} /> Stop Camera</> : <><Camera size={15} /> Live Camera Scan</>}
              </button>
            </div>

            {scanningCamera && (
              <div className="camera-box">
                <div id="live-camera-box" className="camera-viewport" />
                <span className="camera-status">ALIGN QR CODE WITHIN FRAME</span>
              </div>
            )}

            <label className="field-label">CLAIMED USER INTENT</label>
            <div className="segmented">
              <button className={action === "RECEIVE" ? "segment-active receive" : ""} onClick={() => setAction("RECEIVE")}><ArrowDownRight size={16} /> I expect to receive money</button>
              <button className={action === "SEND" ? "segment-active send" : ""} onClick={() => setAction("SEND")}><ArrowUpRight size={16} /> I intend to send money</button>
            </div>

            <div className="field-block">
              <div className="field-heading"><label htmlFor="context">MESSAGE / SMS CONTEXT</label><span>SCAM X-RAY ACTIVE</span></div>
              <textarea id="context" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Paste accompanying chat narrative…" />
              <small>Highlighted keywords are scanned for scam triggers.</small>
            </div>

            <div className="field-block">
              <div className="field-heading"><label htmlFor="upi-uri">UPI URI / DECODED QR PAYLOAD</label><span>STRICTLY VALIDATED</span></div>
              <textarea id="upi-uri" className="uri-input" rows={3} value={uri} onChange={e => setUri(e.target.value)} placeholder="upi://pay?pa=merchant@upi&am=100&cu=INR" spellCheck="false" />
            </div>

            <div className="diff-widget">
              <div className="diff-title"><GitBranch size={14} /> SCAM X-RAY: INTENT-TO-PAYLOAD CONTRADICTION</div>
              <div className="diff-grid">
                <div className="diff-box">
                  <small>CLAIMED MESSAGE INTENT</small>
                  <strong>{action === "RECEIVE" ? "Expects Incoming Funds" : "Intends Outgoing Payment"}</strong>
                  <span>{message ? message.slice(0, 50) + "..." : "No context provided"}</span>
                </div>
                <div className="diff-arrow"><ArrowRight size={16} /></div>
                <div className="diff-box">
                  <small>PROPOSED URI ACTION</small>
                  <strong>
                    {!uri.startsWith("upi://pay?")
                      ? "Invalid / Unsupported URI"
                      : new URL(uri).searchParams.get("mode") === "02"
                        ? "Mode 02 — Verify Semantics"
                        : "Payment Request URI"}
                  </strong>
                  <span>{preview.amount} to {preview.payee}</span>
                </div>
              </div>
            </div>

            {error && <div className="error-banner"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
            
            <button className={`inspect-button ${tourActive && tourStep === 2 ? "spotlight-pulse" : ""}`} disabled={busy || !uri.trim()} onClick={handleGuidedInspect}>
              {busy ? <><RefreshCw className="spin" size={18} /> INSPECTING PAYLOAD…</> : <><Play size={17} fill="currentColor" /> INSPECT PAYMENT INTENT <ChevronRight size={18} /></>}
            </button>
            <p className="privacy-note"><LockKeyhole size={13} /> Transparent weighted scoring engine ensures zero black-box verdicts.</p>
          </div>
        </section>

        <section className="right-column">
          <div className={`panel assessment-panel assessment-${style} ${tourActive && tourStep === 4 ? "spotlight-pulse" : ""}`}>
            <div className="panel-heading">
              <div className="panel-icon red"><Radar size={18} /></div>
              <div><h2>Threat assessment & Breakdown</h2><p>Weighted sum of detected risk signals.</p></div>
              <span className={`risk-tag tag-${style}`}>{result ? result.risk_level.replaceAll("_", " ") : "STANDBY"}</span>
            </div>

            <div className="risk-hero">
              <div className={`risk-ring ring-${style}`} style={{ "--score": `${score ?? 0}%` }}>
                <div className="risk-ring-inner"><span>{score ?? "—"}</span><small>{score === null || score === undefined ? "NO SCORE" : "WEIGHTED"}</small></div>
              </div>
              <div className="risk-copy">
                <span className={`risk-kicker kicker-${style}`}>{result ? "WEIGHTED SCORE" : "AWAITING INSPECTION"}</span>
                <h3>{result ? result.warning_title : "No assessment yet"}</h3>
                <p>{result ? "Calculated from multi-signal weighted sum." : "Load a scenario or inspect a URI to view breakdown."}</p>
              </div>
            </div>
            <div className="risk-meter"><div style={{ width: `${score ?? 0}%` }} className={`risk-meter-fill fill-${style}`} /></div>
            <div className="meter-labels"><span>LOW SIGNAL</span><span>REVIEW</span><span>HIGH SIGNAL</span></div>

            <div className="evidence-section">
              <div className="subsection-heading"><Fingerprint size={15} /> SIGNAL WEIGHT BREAKDOWN <span>{result?.breakdown?.length || 0} SIGNALS</span></div>
              {result?.breakdown?.length ? (
                <div className="evidence-list">{result.breakdown.map((b, i) => (
                  <div className="evidence-item" key={i}><span className="evidence-number">{b.weight}</span><span>{b.label}</span><AlertTriangle size={15} /></div>
                ))}</div>
              ) : <div className="empty-evidence"><FileSearch size={21} /><span>{result ? "No anomalies weighted." : "Breakdown will appear here after inspection."}</span></div>}
            </div>

            {style === "critical" && (
              <div className="friction-card">
                <div className="friction-head">
                  <span>COGNITIVE FRICTION SIMULATOR</span>
                  <span>PRE-PIN INTERCEPT</span>
                </div>
                <p>To interrupt user panic, type <strong>DEDUCT</strong> to simulate manual override:</p>
                <div className="friction-row">
                  <input type="text" value={frictionText} onChange={e => setFrictionText(e.target.value)} placeholder="Type DEDUCT..." />
                  <span className={`friction-badge ${frictionText.toUpperCase() === "DEDUCT" ? "unlocked" : ""}`}>
                    {frictionText.toUpperCase() === "DEDUCT" ? "OVERRIDDEN" : "LOCKED"}
                  </span>
                </div>
              </div>
            )}

            <div className="advice-box">
              <div className="advice-icon"><ShieldAlert size={18} /></div>
              <div><strong>Recommended next step</strong><p>{result ? result.action_advice : "Never enter your UPI PIN to receive money."}</p></div>
            </div>

            {result && <button className="export-button" onClick={exportReport}><Download size={17} /> EXPORT WEIGHTED REPORT <span>.JSON</span></button>}
          </div>

          <div className="panel activity-panel">
            <div className="panel-heading">
              <div className="panel-icon green"><Activity size={18} /></div>
              <div><h2>Activity stream</h2><p>Recent interface events.</p></div>
              <button className="clear-logs" onClick={() => setLogs([])}>CLEAR</button>
            </div>
            <div className="log-list">
              {logs.length ? logs.map((log, i) => (
                <div className="log-row" key={`${log.time}-${i}`}><span className="log-time">{log.time}</span><span className={`log-kind kind-${log.kind.toLowerCase().replaceAll(" ", "-")}`}>{log.kind}</span><span className="log-text">{log.text}</span></div>
              )) : <div className="log-empty">Activity stream cleared.</div>}
            </div>
          </div>
        </section>
      </div>

      <footer className="footer">
        <div><Shield size={14} /> <span>UPI SENTINEL // KAVACH-AI</span> <i /> Weighted Advisory Interface</div>
        <p>Does not block transactions · Does not verify beneficiary identity · Advisory results only</p>
      </footer>
    </main>
  );
}
