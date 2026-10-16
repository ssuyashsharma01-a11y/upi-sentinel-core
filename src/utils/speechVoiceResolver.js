export const REGIONAL_LANG_TAGS = {
  hi: ['hi-IN', 'hi'],
  pa: ['pa-IN', 'pa-Guru-IN', 'pa'],
  mr: ['mr-IN', 'mr-Deva-IN', 'mr'],
  bn: ['bn-IN', 'bn-BD', 'bn'],
  ta: ['ta-IN', 'ta-LK', 'ta'],
  te: ['te-IN', 'te'],
  kn: ['kn-IN', 'kn'],
  en: ['en-IN', 'en-GB', 'en-US']
};

/**
 * Resolves the closest matching SpeechSynthesisVoice for a target language code.
 * Falls back to hi-IN or default en-IN if the regional engine is missing on the client.
 */
export function getBestVoice(langCode = 'hi') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const searchTags = REGIONAL_LANG_TAGS[langCode] || [langCode];

  // 1. Exact match (e.g. 'ta-IN')
  for (const tag of searchTags) {
    const exactVoice = voices.find(
      (v) => v.lang.toLowerCase() === tag.toLowerCase()
    );
    if (exactVoice) return exactVoice;
  }

  // 2. Prefix match (e.g. any voice starting with 'ta')
  const baseCode = langCode.split('-')[0].toLowerCase();
  const prefixVoice = voices.find((v) =>
    v.lang.toLowerCase().startsWith(baseCode)
  );
  if (prefixVoice) return prefixVoice;

  // 3. Fallback: Indian English or Hindi for Indian phonetic compatibility
  return (
    voices.find((v) => v.lang.toLowerCase() === 'hi-in') ||
    voices.find((v) => v.lang.toLowerCase() === 'en-in') ||
    null
  );
}
