import json
import re
import sys
import unicodedata
from urllib.parse import urlparse, parse_qsl, unquote

def normalize_security_text(text):
    if not text or not isinstance(text, str):
        return ""
    zw = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff"))
    nfkc = unicodedata.normalize("NFKC", text).translate(zw).lower().strip()
    devanagari_digits = "०१२३४५६८९"
    for i, d in enumerate(devanagari_digits):
        nfkc = nfkc.replace(d, str(i))
    return nfkc

def extract_all_amounts(text):
    t = normalize_security_text(text)
    re_pat = r'(?:\u20b9|\brs\.?|\binr)\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees\b|rs\b|inr\b|\/-)'
    amounts = []
    for m in re.finditer(re_pat, t, re.IGNORECASE):
        raw = (m.group(1) or m.group(2)).replace(',', '')
        try:
            val = float(raw)
            if val > 0:
                amounts.append(val)
        except ValueError:
            pass
    return amounts

def parse_upi_uri(uri_str):
    if not uri_str or not isinstance(uri_str, str):
        return {"is_valid": False, "error": "Empty or non-string payload"}
    clean = uri_str.strip()
    if not re.match(r'^upi:\/\/pay(\?|$)', clean, re.IGNORECASE):
        return {"is_valid": False, "error": "Invalid URI scheme"}
    try:
        parsed = urlparse(clean)
        pairs = parse_qsl(parsed.query, keep_blank_values=True)
        keys = [k.strip().lower() for k, _ in pairs]
        if len(keys) != len(set(keys)):
            return {"is_valid": False, "error": "Duplicate query parameters", "is_smuggled": True}

        params = {k.strip().lower(): v.strip() for k, v in pairs}
        pa = params.get("pa")
        if not pa:
            return {"is_valid": False, "error": "Missing or malformed pa parameter"}

        pa_unquoted = unquote(pa)
        if not re.match(r'^[\w.\-%]+@[a-zA-Z]{2,64}$', pa_unquoted) and not re.search(r'[\u0400-\u04FF]', pa_unquoted):
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

        return {"is_valid": True, "pa": pa.lower(), "pa_unquoted": pa_unquoted, "pn": pn, "am": parsed_am, "cu": cu, "raw": clean}
    except Exception as e:
        return {"is_valid": False, "error": str(e)}

CONSUMER_PSPS = (
    '@okaxis', '@okhdfcbank', '@okicici', '@oksbi',
    '@ybl', '@ibl', '@axl', '@paytm', '@apl', '@airtel'
)

HIGH_AUTHORITY_PATTERNS = [
    r'\brbi\b', r'\brefund\s*desk\b', r'\belectricity\b',
    r'\bdiscom\b', r'\bbsnl\b', r'\bcustomercare\b', r'\blottery\b', r'\bkbc\b',
    r'\bpolice\b', r'\bchallan\b', r'\btraffic\b', r'\brto\b', r'\bincome\s*tax\b'
]

def evaluate_disparity(msg, uri):
    parsed = parse_upi_uri(uri)
    if not parsed["is_valid"]:
        return "MALFORMED_PAYLOAD"

    norm = normalize_security_text(msg)
    if not norm:
        return "INSUFFICIENT_CONTEXT"

    if "bank never asks for pin" in norm:
        stripped = re.sub(r'bank\s+never\s+asks\s+for\s+pin[.,!]?', '', norm).strip()
        if not any(k in stripped for k in ["bhej", "sent", "pay", "accept", "claim", "approve"]):
            return "INSUFFICIENT_CONTEXT"

    amounts = extract_all_amounts(msg)
    claimed_amount = amounts[0] if amounts else None
    payload_amount = parsed.get("am")

    pa_check = parsed.get("pa_unquoted", parsed["pa"])
    if re.search(r'[\u0400-\u04FF]', pa_check) or "%d" in parsed.get("raw", "").lower() or "%" in parsed["pa"]:
        return "HIGH_INTENT_DISPARITY"

    combined_id = f"{parsed['pa']} {parsed.get('pn', '')}".lower()
    is_high_auth = any(re.search(pat, combined_id, re.IGNORECASE) for pat in HIGH_AUTHORITY_PATTERNS)
    is_consumer_psp = any(parsed["pa"].endswith(psp) for psp in CONSUMER_PSPS)
    if is_high_auth and is_consumer_psp:
        return "HIGH_INTENT_DISPARITY"

    has_pin_negation = bool(re.search(r'\b(pin\s+mat|mat\s+daal|mat\s+dalo|don\'t\s+enter\s+pin)\b', norm) or 'पिन मत डाल' in norm)
    hi_pin_directive = bool(re.search(r'पिन\s*(?:डालो|डालें|दर्ज\s*करें)', norm))
    has_pin_directive = (bool(re.search(r'\b(pin\s*(?:dalo|enter|daalo|daalna|daaliye|dalen)|enter\s*pin|daalo\s*pin)\b', norm)) or hi_pin_directive) and not has_pin_negation

    credit_claims = bool(re.search(r'\b(bhej\s*diya|bhej\s*di\s*hai|bheja\s*hai|bhej\s*diye|i\s*sent\s*you|i\s*have\s*sent|i\s*am\s*paying\s*you|payment.*received|scan\s*to\s*(?:receive|claim)|refund\s*(?:approve|milega)|credit\s*ho\s*jayenge|credited|cashback)\b', norm) or ('रिफंड' in norm or 'पैसे पाने' in norm))
    accept_directive = bool(re.search(r'\b(accept\s*karo|accept\s*karke|claim\s*your\s*payment|receive\s*cashback)\b', norm))
    is_user_send = bool(re.search(r'\b(paying\s+(?:bill|cab|chai|mess)|paid\s*to|send\s*to\s*driver)\b', norm)) and not credit_claims

    urgency_kw = [r'\burgent\b', r'\bimmediately\b', r'\bpower disconnected\b', r'\bdisconnected tonight\b', r'\bpower cut\b', r'\bpolice\b', r'\bbijli\s*kat\b']
    has_urgency = any(re.search(p, norm) for p in urgency_kw)

    is_hi_explicit_pin = hi_pin_directive and not has_pin_negation
    is_uncorroborated_trap = credit_claims and claimed_amount is None and not is_user_send

    if is_hi_explicit_pin:
        return "CRITICAL_INTENT_DISPARITY"
    if is_uncorroborated_trap:
        return "HIGH_INTENT_DISPARITY"
    if has_pin_directive:
        return "CRITICAL_INTENT_DISPARITY"
    if has_pin_negation and (credit_claims or accept_directive):
        return "HIGH_INTENT_DISPARITY"
    if credit_claims and not is_user_send:
        if payload_amount and payload_amount > 0 and claimed_amount is not None:
            return "CRITICAL_INTENT_DISPARITY"
        return "HIGH_INTENT_DISPARITY"
    if accept_directive and not is_user_send:
        return "CRITICAL_INTENT_DISPARITY" if not has_pin_negation else "HIGH_INTENT_DISPARITY"
    if claimed_amount and payload_amount and abs(claimed_amount - payload_amount) > 0.01:
        return "HIGH_INTENT_DISPARITY"
    if has_urgency and not is_user_send:
        return "HIGH_INTENT_DISPARITY"

    return "NO_DISPARITY_DETECTED"

def run_suite():
    try:
        with open("test_fixtures.json", "r", encoding="utf-8-sig") as f:
            fixtures = json.load(f)
    except Exception as e:
        print(f"Failed to load fixtures: {e}")
        sys.exit(1)

    passed = 0
    total = len(fixtures)
    for fix in fixtures:
        verdict = evaluate_disparity(fix["text"], fix["uri"])
        if verdict == fix["expected_verdict"]:
            passed += 1
        else:
            print(f"FAILED Test #{fix['id']}: expected {fix['expected_verdict']}, got {verdict}")

    print(f"\nPython eval_engine: {passed}/{total} fixtures passed.")
    if passed != total:
        sys.exit(1)

if __name__ == "__main__":
    run_suite()