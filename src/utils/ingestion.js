/**
 * Ingestion handler: Extracts raw payload URI and message context
 * without contacting external servers or logging data.
 */
export function extractSharedPayload(searchParams) {
  const text = searchParams.get('text') || searchParams.get('title') || '';
  const url = searchParams.get('url') || '';

  let candidateUri = '';
  let candidateContext = text;

  // Direct URI shared in URL parameter
  if (url && /^upi:\/\/pay/i.test(url.trim())) {
    candidateUri = url.trim();
  } 
  // UPI URI embedded inside shared text (e.g., SMS / WhatsApp share)
  else if (text) {
    const uriMatch = text.match(/upi:\/\/pay[^\s"'>]+/i);
    if (uriMatch) {
      candidateUri = uriMatch[0];
      candidateContext = text.replace(candidateUri, '').trim();
    }
  }

  return {
    rawUri: candidateUri,
    rawContext: candidateContext
  };
}