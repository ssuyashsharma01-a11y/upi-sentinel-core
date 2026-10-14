import json
import re
import sys
from urllib.parse import urlparse, parse_qs

def parse_upi_uri(uri_str):
    if not uri_str or not isinstance(uri_str, str):
        return {"is_valid": False, "error": "Empty or non-string payload"}
    clean = uri_str.strip()
    if not re.match(r'^upi:\/\/pay(\?|$)', clean, re.IGNORECASE):
        return {"is_valid": False, "error": "Invalid URI scheme"}
    try:
        parsed = urlparse(clean)
        query_items = parsed.query.split('&') if parsed.query else []
        param_keys = [item.split('=')[0].lower() for item in query_items if '=' in item]
        if len(param_keys) != len(set(param_keys)):
            return {"is_valid": False, "error": "Duplicate query parameters"}
            
        params = parse_qs(parsed.query, keep_blank_values=True)
        pa_list = params.get("pa", [])
        pa = pa_list[0].strip() if pa_list else None
        if not pa or '@' not in pa:
            return {"is_valid": False, "error": "Missing or malformed pa parameter"}
            
        pn = params.get("pn", ["Unregistered"])[0].strip()
        cu = params.get("cu", ["INR"])[0].strip().upper()
        if cu != "INR":
            return {"is_valid": False, "error": "Unsupported currency"}
            
        am_raw = params.get("am", [None])[0]
        parsed_am = None
        if am_raw:
            if not re.match(r'^\d+(\.\d{1,2})?$', am_raw):
                return {"is_valid": False, "error": "Malformed amount numeric string"}
            parsed_am = float(am_raw)
            if parsed_am <= 0:
                return {"is_valid": False, "error": "Amount must be > 0"}
                
        return {"is_valid": True, "pa": pa, "pn": pn, "am": parsed_am, "cu": cu}
    except Exception as e:
        return {"is_valid": False, "error": str(e)}

def evaluate_disparity(msg, uri):
    parsed = parse_upi_uri(uri)
    if not parsed["is_valid"]:
        return "MALFORMED_PAYLOAD"
    
    lower = (msg or "").lower().strip()
    
    amt = None
    if not re.search(r'(?:₹|rs\.?|inr)\s*-\s*\d+', lower):
        m = re.search(r'(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)(?!\s*-\s*\d)', lower) or \
            re.search(r'(?:\b|^)([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs|inr|\/-)', lower)
        if m:
            raw = m.group(1).replace(',', '')
            try:
                amt = float(raw)
            except ValueError:
                amt = None

    has_pin_negation = bool(re.search(r'\b(pin\s+mat|mat\s+daal|mat\s+dalo|don\'t\s+enter\s+pin)\b', lower))
    has_pin_directive = bool(re.search(r'\b(pin\s*dalo|enter\s*pin|pin\s*daalo|daalo\s*pin)\b', lower)) and not has_pin_negation
    has_accept = bool(re.search(r'\b(accept\s*karo|accept\s*karke|credit\s*receive|claim\s*karo|receive\s*karo|scan\s*karke)\b', lower))
    has_cp_claim = bool(re.search(r'\b(bhej\s*diya|bhej\s*di\s*hai|bheja\s*hai|bhej\s*diye|i\s*sent\s*you|i\s*have\s*sent|refund\s*approve|credit\s*ho\s*jayenge|credited)\b', lower))
    
    # Matches "payment ... sent to", "paying", "paid to"
    has_user_send = bool(re.search(r'\b(paying|paid\s*to|payment\s.*sent\s*to|send\s*to\s*driver|bill\s*pay|pay\s*kar\s*raha)\b', lower))
    
    urgency_kw = [r'\burgent\b', r'\bimmediately\b', r'\bpower disconnected\b', r'\bdisconnected tonight\b', r'\bpower cut\b', r'\bpolice\b']
    has_urgency = any(re.search(p, lower) for p in urgency_kw)

    amt_match = (amt is not None and parsed["am"] is not None and abs(amt - parsed["am"]) < 0.01)
    amt_mismatch = (amt is not None and parsed["am"] is not None and not amt_match)

    is_reverse_charge = (has_cp_claim or has_accept or has_pin_directive) and (has_pin_directive or has_accept or has_cp_claim)

    # CRITICAL requires BOTH reverse charge signal AND exact corroborated amount
    if is_reverse_charge and amt_match:
        return "CRITICAL_INTENT_DISPARITY"
        
    if is_reverse_charge:
        return "HIGH_INTENT_DISPARITY"
        
    if has_user_send and amt_mismatch:
        return "HIGH_INTENT_DISPARITY"
        
    if has_user_send and not is_reverse_charge and not has_urgency:
        return "NO_DISPARITY_DETECTED"
        
    return "INSUFFICIENT_CONTEXT"

def run_suite():
    with open("test_fixtures.json", "r", encoding="utf-8-sig") as f:
        tests = json.load(f)
        
    correct = 0
    tp = fp = tn = fn = 0
    print("\n" + "="*76)
    print("      UPI SENTINEL: DISPARITY ENGINE (CLI REFERENCE RUNNER)")
    print("="*76 + "\n")
    print(f"{'ID':<4} {'Scenario':<42} {'Expected':<22} {'Actual':<22} {'Result'}")
    print("-" * 76)
    
    for t in tests:
        v = evaluate_disparity(t["text"], t["uri"])
        is_pass = (v == t["expected_verdict"])
        if is_pass:
            correct += 1
            status = "PASS [✓]"
        else:
            status = "FAIL [✗]"
        print(f"#{t['id']:02d} {t['scenario']:<42} {t['expected_verdict']:<22} {v:<22} {status}")
        
        flagged = v in ["CRITICAL_INTENT_DISPARITY", "HIGH_INTENT_DISPARITY"]
        if t["is_deception"] and flagged: tp += 1
        elif not t["is_deception"] and flagged: fp += 1
        elif not t["is_deception"] and not flagged: tn += 1
        elif t["is_deception"] and not flagged: fn += 1

    accuracy = (correct / len(tests)) * 100
    print("\n" + "-"*76)
    print(f"  Exact-Verdict Match: {correct}/{len(tests)} ({accuracy:.1f}%)")
    print(f"  Threats Intercepted: {tp}/{tp + fn} scams flagged | False Alarms: {fp}")
    print(f"  Confusion Matrix   : [TP: {tp}, FP: {fp}, TN: {tn}, FN: {fn}]")
    print("="*76 + "\n")
    if correct != len(tests):
        sys.exit(1)

if __name__ == "__main__":
    run_suite()