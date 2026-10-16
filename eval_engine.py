import json
import re
import sys
import unicodedata
from urllib.parse import urlparse, parse_qsl, unquote_plus

def parse_upi_uri(uri_str):
    if not uri_str or not isinstance(uri_str, str):
        return {"is_valid": False, "error": "Empty or non-string payload"}
    clean = uri_str.strip()
    if not re.match(r'^upi:\/\/pay(\?|$)', clean, re.IGNORECASE):
        return {"is_valid": False, "error": "Invalid URI scheme"}
    try:
        parsed = urlparse(clean)
        # Decode first, check duplicates to prevent smuggling (%61m=5000 vs am=1)
        pairs = parse_qsl(parsed.query, keep_blank_values=True)
        keys = [k.strip().lower() for k, _ in pairs]
        if len(keys) != len(set(keys)):
            return {"is_valid": False, "error": "Duplicate query parameters"}
            
        params = {k.strip().lower(): v.strip() for k, v in pairs}
        pa = params.get("pa")
        if not pa or not re.match(r'^[\w.\-]{2,256}@[a-zA-Z]{2,64}$', pa):
            return {"is_valid": False, "error": "Missing or malformed pa parameter"}
            
        pn = params.get("pn", "Unregistered").strip()
        cu = params.get("cu", "INR").strip().upper()
        if cu != "INR":
            return {"is_valid": False, "error": "Unsupported currency"}
            
        am_raw = params.get("am")
        parsed_am = None
        if am_raw:
            if not re.match(r'^\d+(\.\d{1,2})?$', am_raw):
                return {"is_valid": False, "error": "Malformed amount numeric string"}
            parsed_am = float(am_raw)
            if parsed_am <= 0:
                return {"is_valid": False, "error": "Amount must be > 0"}
                
        return {"is_valid": True, "pa": pa.lower(), "pn": pn, "am": parsed_am, "cu": cu}
    except Exception as e:
        return {"is_valid": False, "error": str(e)}

def normalize_text(text):
    if not text:
        return ""
    zw = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff"))
    nfkc = unicodedata.normalize("NFKC", text).translate(zw).lower().strip()
    # Devanagari numerals to ASCII
    devanagari_digits = "०१२३४५६७८९"
    for i, d in enumerate(devanagari_digits):
        nfkc = nfkc.replace(d, str(i))
    return nfkc

def extract_all_amounts(text):
    t = normalize_text(text)
    re_pat = r'(?:\u20b9|\brs\.?|\binr)\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees\b|rs\b|inr\b|\/-)'
    amounts = []
    for m in re.finditer(re_pat, t):
        raw = (m.group(1) or m.group(2)).replace(',', '')
        try:
            val = float(raw)
            if val > 0:
                amounts.append(val)
        except ValueError:
            pass
    return amounts

def evaluate_disparity(msg, uri):
    parsed = parse_upi_uri(uri)
    if not parsed["is_valid"]:
        return "MALFORMED_PAYLOAD"
    
    lower = normalize_text(msg)
    amounts = extract_all_amounts(msg)
    amt = amounts[0] if amounts else None

    has_pin_negation = bool(re.search(r'\b(pin\s+mat|mat\s+daal|mat\s+dalo|don\'t\s+enter\s+pin)\b', lower))
    has_pin_directive = bool(re.search(r'\b(pin\s*(?:dalo|enter|daalo|daalna|daaliye|dalen)|enter\s*pin|daalo\s*pin|पिन\s*(?:डालो|डालें|दर्ज\s*करें))\b', lower)) and not has_pin_negation
    has_accept = bool(re.search(r'\b(accept\s*karo|accept\s*karke|credit\s*receive|claim\s*karo|receive\s*karo|scan\s*karke|पैसे\s*(?:प्राप्त|स्वीकार)\s*करें)\b', lower))
    has_cp_claim = bool(re.search(r'\b(bhej\s*diya|bhej\s*di\s*hai|bheja\s*hai|bhej\s*diye|i\s*sent\s*you|i\s*have\s*sent|refund\s*(?:approve|milega)|credit\s*ho\s*jayenge|credited|रिफंड\s*मिलेगा)\b', lower))
    
    has_user_send = bool(re.search(r'\b(paying|paid\s*to|payment\s.*sent\s*to|send\s*to\s*driver|bill\s*pay|pay\s*kar\s*raha)\b', lower))
    
    urgency_kw = [r'\burgent\b', r'\bimmediately\b', r'\bpower disconnected\b', r'\bdisconnected tonight\b', r'\bpower cut\b', r'\bpolice\b', r'\bbijli\s*kat\b']
    has_urgency = any(re.search(p, lower) for p in urgency_kw)

    if has_cp_claim and parsed.get("am") and parsed["am"] > 0:
        return "CRITICAL_INVERSION"
    if has_pin_directive:
        return "CRITICAL_INVERSION"
    if has_urgency and not has_user_send:
        return "HIGH_COERCION"
    if has_accept and not has_user_send:
        return "HIGH_COERCION"
    return "CLEAN_BASELINE"

if __name__ == "__main__":
    print("eval_engine ready")
