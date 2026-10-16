// Pure client-side Web Crypto API for zero external dependency
export async function generateZkScamSignature(parsedUri, reason) {
  if (!parsedUri?.pa) return null;

  const rawVpa = parsedUri.pa.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(rawVpa);
  
  // Standard Cryptographic SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const vpaHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Extract non-identifying structural heuristics
  const pspHandle = rawVpa.includes('@') ? '@' + rawVpa.split('@')[1] : 'unknown';
  
  return {
    vpa_sha256: vpaHash,
    psp_domain: pspHandle,
    claimed_amount: parsedUri.am || null,
    threat_category: reason || 'SUSPECTED_REVERSE_CHARGE',
    timestamp: new Date().toISOString(),
    engine_ver: 'IADE-v3.0'
  };
}
