/**
 * On-Device Synthetic Voice & Audio Artifact Detector
 * Analyzes audio frequency bins via Web Audio API AnalyserNode.
 */

export function analyzeAudioSpectrum(frequencyData, sampleRate = 44100) {
  const binCount = frequencyData.length;
  const nyquist = sampleRate / 2;
  const binHz = nyquist / binCount;

  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  let totalEnergy = 0;

  for (let i = 0; i < binCount; i++) {
    const freq = i * binHz;
    const amplitude = frequencyData[i];
    totalEnergy += amplitude;

    if (freq >= 100 && freq < 1000) lowEnergy += amplitude;
    else if (freq >= 1000 && freq < 4000) midEnergy += amplitude;
    else if (freq >= 8000 && freq < 16000) highEnergy += amplitude;
  }

  // Prevent division by zero during silence
  if (totalEnergy < 500) {
    return {
      status: 'SILENT_OR_LOW_INPUT',
      syntheticRiskScore: 0.0,
      signals: [{ id: 'INSUFFICIENT_AUDIO_AMPLITUDE', weight: 0 }]
    };
  }

  const signals = [];
  let score = 0;

  // 1. High-Frequency Spectral Droop Check (Vocoder Cutoff)
  // AI vocoders roll off sharply above 7.5kHz - 8kHz (< 4% energy)
  const highRatio = highEnergy / (midEnergy || 1);
  if (highRatio < 0.04) {
    signals.push({
      id: 'HIGH_FREQUENCY_SPECTRAL_CUTOFF',
      weight: 65,
      detail: `High-band harmonic ratio abnormally low: ${(highRatio * 100).toFixed(1)}%`
    });
    score += 65;
  }

  // 2. Formant Energy Distribution (Realistic human range: 0.20 to 5.0)
  const lowToMidRatio = lowEnergy / (midEnergy || 1);
  if (lowToMidRatio < 0.20 || lowToMidRatio > 5.0) {
    signals.push({
      id: 'UNNATURAL_ENERGY_DISTRIBUTION',
      weight: 35,
      detail: 'Formant energy balance deviates from organic speech profile'
    });
    score += 35;
  }

  // Verdict Resolution
  let verdict = 'ORGANIC_VOICE_PROFILE';
  if (score >= 65) {
    verdict = 'SYNTHETIC_VOICE_FLAGGED';
  } else if (score >= 35) {
    verdict = 'ANOMALOUS_AUDIO_SPECTRUM';
  }

  return {
    verdict,
    syntheticRiskScore: Math.min(1.0, score / 100),
    signals,
    metrics: {
      highRatio: parseFloat(highRatio.toFixed(3)),
      lowToMidRatio: parseFloat(lowToMidRatio.toFixed(3))
    }
  };
}
