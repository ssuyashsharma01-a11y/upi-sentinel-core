import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, AlertTriangle, ShieldCheck, Activity, PhoneCall } from 'lucide-react';
import { analyzeAudioSpectrum } from '../engine/voiceVerifier.js';

export default function VoiceVerifier() {
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      setResult(null);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let sampleFrames = 0;
      let aggregatedData = new Float64Array(analyser.frequencyBinCount);

      const sampleLoop = () => {
        analyser.getByteFrequencyData(buffer);
        
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
          aggregatedData[i] += buffer[i];
        }
        setAudioLevel(Math.min(100, Math.round((sum / buffer.length) * 1.5)));
        sampleFrames++;

        // Analyze after capturing ~120 frames (~2-3 seconds of live speech)
        if (sampleFrames >= 120) {
          const averaged = new Uint8Array(buffer.length);
          for (let i = 0; i < buffer.length; i++) {
            averaged[i] = Math.round(aggregatedData[i] / sampleFrames);
          }
          const analysis = analyzeAudioSpectrum(averaged, audioCtx.sampleRate);
          setResult(analysis);
          stopListening();
          return;
        }

        animFrameRef.current = requestAnimationFrame(sampleLoop);
      };

      animFrameRef.current = requestAnimationFrame(sampleLoop);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
    setIsListening(false);
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => stopListening();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100 max-w-xl mx-auto my-6">
      <div className="flex items-center space-x-3 mb-4">
        <PhoneCall className="w-6 h-6 text-amber-400" />
        <h2 className="text-xl font-bold tracking-tight">Panic Call Synthetic Voice Radar</h2>
      </div>
      <p className="text-sm text-slate-400 mb-6">
        "Papa main musibat me hoon, paise bhejo" — Aisi panic calls par speakerphone on karke mic ke paas rakhein. On-device FFT AI voice artifacts aur cutoff frequencies ko inspect karega.
      </p>

      {/* Mic Trigger */}
      <div className="flex flex-col items-center justify-center p-6 bg-slate-950/60 rounded-xl border border-slate-800">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
            isListening
              ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
          }`}
        >
          {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
        </button>

        <span className="text-xs font-semibold mt-3 text-slate-300">
          {isListening ? 'Sampling audio (Keep near speaker)...' : 'Tap to Sample 3 Seconds of Call'}
        </span>

        {isListening && (
          <div className="w-48 bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div className="bg-amber-400 h-2 transition-all duration-75" style={{ width: `${audioLevel}%` }}></div>
          </div>
        )}
      </div>

      {/* Analysis Result */}
      {result && (
        <div className={`mt-6 p-4 rounded-xl border ${
          result.verdict === 'SYNTHETIC_VOICE_FLAGGED'
            ? 'bg-red-950/40 border-red-800/80 text-red-200'
            : result.verdict === 'ANOMALOUS_AUDIO_SPECTRUM'
            ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
            : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
        }`}>
          <div className="flex items-center space-x-2 font-bold text-lg mb-2">
            {result.verdict === 'ORGANIC_VOICE_PROFILE' ? (
              <>
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <span>Natural Human Harmonic Profile</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <span>{result.verdict === 'SYNTHETIC_VOICE_FLAGGED' ? 'High Risk: Synthetic Voice Detected!' : 'Warning: Anomalous Voice Characteristics'}</span>
              </>
            )}
          </div>

          <p className="text-xs text-slate-300 mb-3">
            {result.verdict === 'SYNTHETIC_VOICE_FLAGGED'
              ? '⚠️ Audio me high-frequency vocoder cutoff paya gaya hai. Turant call kaat kar apne relative ke personal number par callback karein!'
              : 'Organic spectral distribution detect hua hai. Hamesha independent verification confirm karein.'}
          </p>

          {result.signals.length > 0 && (
            <ul className="text-xs list-disc pl-5 space-y-1 bg-black/30 p-3 rounded-lg">
              {result.signals.map((sig, i) => (
                <li key={i}><strong>{sig.id}:</strong> {sig.detail || 'Anomaly identified'}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
