import { getBestVoice, REGIONAL_LANG_TAGS } from './speechVoiceResolver.js';

export function playVoiceAdvisory({
  title,
  oneLiner,
  actionText,
  lang = 'hi',
  onEnd
}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  const headline = typeof title === 'object' ? (title[lang] || title.hi || title.en) : title;
  const advice = typeof actionText === 'object' ? (actionText[lang] || actionText.hi || actionText.en) : actionText;
  const summary = typeof oneLiner === 'function' 
    ? (oneLiner()[lang] || oneLiner().hi || oneLiner().en) 
    : (oneLiner?.[lang] || oneLiner?.hi || oneLiner?.en || '');

  const textToRead = `${headline}. ${summary}. ${advice}`;
  const utterance = new SpeechSynthesisUtterance(textToRead);

  // Set standard BCP-47 tag
  const primaryTag = REGIONAL_LANG_TAGS[lang]?.[0] || 'hi-IN';
  utterance.lang = primaryTag;

  // Assign voice object if available on the platform
  const matchedVoice = getBestVoice(lang);
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  // Dialed-in rates: slightly slower cadence for clarity & Dravidian language phrasing
  utterance.rate = 0.88;
  utterance.pitch = 1.0;

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}
