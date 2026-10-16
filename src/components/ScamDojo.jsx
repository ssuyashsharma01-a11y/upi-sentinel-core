import React, { useState } from 'react';
import { DOJO_SCENARIOS } from '../data/dojoScenarios.js';
import { evaluateDisparity } from '../engine/disparityEngine.js';
import { ShieldAlert, ShieldCheck, Award, Flame, AlertCircle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

export default function ScamDojo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(null);

  const scenario = DOJO_SCENARIOS[currentIndex];

  const handleAction = (selectedAction) => {
    const isCorrect = selectedAction === scenario.correctAction || 
      (selectedAction === 'REJECT_AND_BLOCK' && scenario.correctAction === 'REPORT_FRAUD') ||
      (selectedAction === 'REPORT_FRAUD' && scenario.correctAction === 'REJECT_AND_BLOCK');

    const disparityResult = evaluateDisparity(scenario.message, scenario.uri);

    if (isCorrect) {
      const addedPoints = 100 + (streak * 25);
      setScore(prev => prev + addedPoints);
      setStreak(prev => prev + 1);
      setCurrentFeedback({
        status: 'SUCCESS',
        points: addedPoints,
        disparityResult,
        explanation: scenario.explanation
      });
    } else {
      setStreak(0);
      setCurrentFeedback({
        status: 'FAILED',
        points: 0,
        disparityResult,
        explanation: scenario.explanation
      });
    }
  };

  const handleNext = () => {
    setCurrentFeedback(null);
    if (currentIndex + 1 < DOJO_SCENARIOS.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setCompleted(false);
    setCurrentFeedback(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 max-w-2xl mx-auto my-6 font-sans">
      {/* Dojo Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <Award className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight">Scam Simulator Dojo</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Zero-risk training arena: Spot deceptive reverse-charge heuristics and social engineering traps.
          </p>
        </div>

        <div className="flex items-center space-x-4 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-1">
            <Flame className={`w-5 h-5 ${streak > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-600'}`} />
            <span className="font-mono text-sm font-bold">{streak}x</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Dojo Score</span>
            <span className="font-mono text-base font-extrabold text-emerald-400">{score}</span>
          </div>
        </div>
      </div>

      {!completed ? (
        <div>
          {/* Progress & Badge */}
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-slate-400 font-mono font-medium">Scenario {currentIndex + 1} of {DOJO_SCENARIOS.length}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              {scenario.tag}
            </span>
          </div>

          {/* Scenario Details */}
          <div className="bg-slate-950 rounded-xl p-5 border border-slate-800/80 mb-5">
            <h3 className="font-bold text-base text-slate-200 mb-2">{scenario.title}</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">{scenario.context}</p>

            {/* Simulated Phone Message Bubble */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-3.5 mb-3 font-mono text-xs text-slate-300">
              <span className="text-[10px] text-amber-400 font-sans block mb-1 uppercase tracking-wider font-semibold">Incoming Message Payload:</span>
              "{scenario.message}"
            </div>

            {/* Embedded Deep Link */}
            <div className="bg-black/40 rounded-lg p-2.5 font-mono text-[11px] text-slate-400 break-all border border-slate-800">
              <span className="text-slate-500">URI: </span>{scenario.uri}
            </div>
          </div>

          {/* Action Choice Interface */}
          {!currentFeedback ? (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleAction('PAY_AND_ACCEPT')}
                className="py-3 px-2 bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 text-red-300 rounded-xl text-xs font-semibold transition-all"
              >
                Enter PIN & Proceed
              </button>
              <button
                onClick={() => handleAction('REJECT_AND_BLOCK')}
                className="py-3 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all"
              >
                Reject & Block Sender
              </button>
              <button
                onClick={() => handleAction('REPORT_FRAUD')}
                className="py-3 px-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/20"
              >
                Flag IADE Disparity
              </button>
            </div>
          ) : (
            /* Forensic Dissection & Verdict Card */
            <div className={`p-4 rounded-xl border ${
              currentFeedback.status === 'SUCCESS'
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                : 'bg-red-950/40 border-red-800/80 text-red-200'
            }`}>
              <div className="flex items-center space-x-2 font-bold text-sm mb-2">
                {currentFeedback.status === 'SUCCESS' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Scam Deflected! (+{currentFeedback.points} pts)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span>Trap Triggered! Account Would Have Been Debited.</span>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-300 mb-3">{currentFeedback.explanation}</p>

              {/* Engine Signals Reveal */}
              <div className="bg-black/30 p-3 rounded-lg text-xs font-mono mb-4">
                <span className="text-[10px] text-slate-400 block mb-1 uppercase">IADE Forensic Signals Triggered:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                  {currentFeedback.disparityResult.signals.map((sig, i) => (
                    <li key={i}>{sig.id} (weight: {sig.weight})</li>
                  ))}
                </ul>
              </div>

              <button
                onClick={handleNext}
                className="w-full py-2.5 bg-slate-100 hover:bg-white text-slate-900 font-bold text-xs rounded-lg transition-all"
              >
                {currentIndex + 1 < DOJO_SCENARIOS.length ? 'Next Scenario →' : 'View Dojo Report Card'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Final Completion Report Card */
        <div className="text-center py-6">
          <div className="inline-flex p-4 rounded-full bg-emerald-950/80 border border-emerald-800 mb-4">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold mb-1">Dojo Training Complete!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            Aapne sabhi 5 critical adversary scenarios ko forensic heuristics ke sath analyze kar liya hai.
          </p>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-w-xs mx-auto mb-6">
            <span className="text-xs text-slate-500 uppercase font-semibold">Final Defense Score</span>
            <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">{score}</div>
          </div>

          <button
            onClick={handleReset}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retrain in Dojo</span>
          </button>
        </div>
      )}
    </div>
  );
}
