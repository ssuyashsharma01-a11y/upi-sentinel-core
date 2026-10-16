import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getBestVoice, REGIONAL_LANG_TAGS } from '../src/utils/speechVoiceResolver.js';

describe('Speech Voice Resolver Unit Tests', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it('All 8 supported languages map to configured BCP-47 tags', () => {
    const required = ['hi', 'pa', 'mr', 'bn', 'ta', 'te', 'kn', 'en'];
    for (const code of required) {
      expect(REGIONAL_LANG_TAGS[code], `Missing tags for ${code}`).toBeDefined();
      expect(REGIONAL_LANG_TAGS[code].length).toBeGreaterThan(0);
    }
  });

  it('Resolves exact regional voice when available', () => {
    const mockVoices = [
      { name: 'Google தமிழ்', lang: 'ta-IN' },
      { name: 'Google हिन्दी', lang: 'hi-IN' }
    ];

    globalThis.window = {
      speechSynthesis: {
        getVoices: () => mockVoices
      }
    };

    const voice = getBestVoice('ta');
    expect(voice?.lang).toBe('ta-IN');
  });

  it('Falls back to hi-IN or en-IN if exact regional voice is missing', () => {
    const mockVoices = [
      { name: 'Google हिन्दी', lang: 'hi-IN' },
      { name: 'Google US English', lang: 'en-US' }
    ];

    globalThis.window = {
      speechSynthesis: {
        getVoices: () => mockVoices
      }
    };

    const voice = getBestVoice('kn'); // Kannada not installed in mock voices
    expect(voice?.lang.toLowerCase()).toBe('hi-in');
  });

  it('Returns null when window or speechSynthesis is not supported', () => {
    delete globalThis.window;
    const voice = getBestVoice('hi');
    expect(voice).toBeNull();
  });
});
