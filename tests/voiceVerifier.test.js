import { describe, it, expect } from 'vitest';
import { analyzeAudioSpectrum } from '../src/engine/voiceVerifier.js';

describe('Panic Call Voice Verifier Tests', () => {
  it('Flags synthetic vocoder with sharp high-frequency cutoff', () => {
    // 1024 bins simulating synthetic audio with silence in high frequency band
    const mockSyntheticBins = new Uint8Array(1024);

    // High energy in low and mid bands
    for (let i = 10; i < 200; i++) mockSyntheticBins[i] = 180;
    // Abrupt cutoff at 8kHz (bin index ~370+)
    for (let i = 370; i < 1024; i++) mockSyntheticBins[i] = 2;

    const res = analyzeAudioSpectrum(mockSyntheticBins, 44100);
    expect(res.verdict).toBe('SYNTHETIC_VOICE_FLAGGED');
    expect(res.signals.some(s => s.id === 'HIGH_FREQUENCY_SPECTRAL_CUTOFF')).toBe(true);
  });

  it('Recognizes organic voice with balanced natural harmonic air bands', () => {
    const mockOrganicBins = new Uint8Array(1024);

    // Realistic voice gradient across low, mid, and high harmonics
    for (let i = 10; i < 100; i++) mockOrganicBins[i] = 160;
    for (let i = 100; i < 300; i++) mockOrganicBins[i] = 120;
    for (let i = 370; i < 750; i++) mockOrganicBins[i] = 45; // Organic high-end energy

    const res = analyzeAudioSpectrum(mockOrganicBins, 44100);
    expect(res.verdict).toBe('ORGANIC_VOICE_PROFILE');
    expect(res.syntheticRiskScore).toBeLessThan(0.4);
  });

  it('Handles background silence gracefully without false alarms', () => {
    const silentBins = new Uint8Array(1024); // All zeros
    const res = analyzeAudioSpectrum(silentBins, 44100);
    expect(res.status).toBe('SILENT_OR_LOW_INPUT');
    expect(res.syntheticRiskScore).toBe(0.0);
  });
});
