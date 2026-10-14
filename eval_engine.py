import json
import re
import sys
from urllib.parse import urlparse, parse_qs

def parse_upi_uri(uri_str):
    if not uri_str or not isinstance(uri_str, str):
        return {"is_valid": False, "error": "Empty or non-string payload"}
    clean = uri_str.strip()
    
    # Strict URI scheme matching (case-insensitive)
    if not re.match(r'^upi:\/\/pay(\?|$)', clean, re.IGNORECASE):
        return {"is_valid": False, "error": "Invalid URI scheme. Must strictly start with upi://pay"}
        
    try:
        parsed = urlparse(clean)
        # Check raw query for duplicate parameters
        query_items = parsed.query.split('&') if parsed.query else []
        param_keys = [item.split('=')[0].lower() for item in query_items if '=' in item]
        if len(param_keys) != len(set(param_keys)):
            return {"is_valid": False, "error": "Conflicting duplicate query parameters detected"}
            
        params = parse_qs(parsed.query, keep_blank_values=True)
        
        # VPA Validation
        pa_list = params.get("pa", [])
        pa = pa_list[0].strip() if pa_list else None
        if not pa:
            return {"is_valid": False, "error": "Missing mandatory VPA (pa) parameter"}
        if '@' not in pa or len(pa.split('@')[0]) == 0 or len(pa.split('@')[1]) == 0:
            return {"is_valid": False, "error": "Malformed VPA format (must contain user@bank handle)"}
            
        pn_list = params.get("pn", [])
        pn = pn_list[0].strip() if pn_list and pn_list[0].strip() else "Unregistered Payee Label"
        
        # Currency Validation
        cu_list = params.get("cu", [])
        cu = cu_list[0].strip().upper() if cu_list else "INR"
        if cu != "INR":
            return {"is_valid": False, "error": f"Unsupported transaction currency: {cu}. Only INR is valid."}
            
        # Amount Validation
        am_list = params.get("am", [])
        am_raw = am_list[0].strip() if am_list else None
        
        parsed_am = None
        if am_raw is not None and am_raw != "":
            if not re.match(r'^\d+(\.\d{1,2})?$', am_raw):
                return {"is_valid": False, "error": "Malformed amount numeric string"}
            try:
                parsed_am = float(am_raw)
                if parsed_am <= 0:
                    return {"is_valid": False, "error": "Payload amount must be strictly greater than zero"}
            except ValueError:
                return {"is_valid": False, "error": "Amount parsing failed"}
                
        return {
            "is_valid": True,
            "pa": pa,
            "pn": pn,
            "am": parsed_am,
            "cu": cu
        }
    except Exception as e:
        return {"is_valid": False, "error": f"URI parse exception: {str(e)}"}

def validate_comma_grouping(num_str):
    if ',' not in num_str:
        return True
    # Western: ^\d{1,3}(,\d{3})+$ | Indian: ^\d{1,2}(,\d{2})*,\d{3}$ or ^\d{1,3},\d{3}$
    parts = num_str.split('.')
    integer_part = parts[0]
    subparts = integer_part.split(',')
    
    # Check Western standard 3-digit groups
    is_western = len(subparts[0]) in (1, 2, 3) and all(len(p) == 3 for p in subparts[1:])
    # Check Indian standard grouping: first 1-3 digits, then 2-digit groups, ending in 3 digits
    is_indian = False
    if len(subparts) >= 2:
        if len(subparts[-1]) == 3 and all(len(p) == 2 for p in subparts[1:-1]) and len(subparts[0]) in (1, 2):
            is_indian = True
            
    return is_western or is_indian

def extract_intent(text):
    if not text or not text.strip():
        return {"type": "NONE", "amount": None, "has_urgency": False, "cues": [], "has_negation": False}
    
    lower = text.lower().strip()
    
    # Check Negation
    negation_patterns = [r'\bmat\b', r'\bdon\'t\b', r'\bdo not\b', r'\bkabhi mat\b', r'\bnever\b']
    has_negation = any(re.search(pat, lower) for pat in negation_patterns)
    
    # Amount Parsing with strict validation
    amt = None
    if not (re.search(r'(?:₹|rs\.?|inr)\s*-\s*\d+', lower) or re.search(r'-\s*(?:₹|rs\.?|inr)\s*\d+', lower)):
        amt_match = re.search(r'(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)(?!\s*-\s*\d)', lower) or \
                    re.search(r'(?:\b|^)([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs|inr|\/-)', lower)
        if amt_match:
            raw_val = amt_match.group(1)
            if validate_comma_grouping(raw_val):
                try:
                    val = float(raw_val.replace(',', ''))
                    if val > 0:
                        amt = val
                except ValueError:
                    amt = None
                    
    # Urgency & Panic Detection (Restricted to genuine panic cues, excluding generic 'electricity')
    urgency_patterns = [
        r'\burgent\b', r'\bimmediately\b', r'\bpower disconnected\b', r'\bdisconnected tonight\b',
        r'\bpower cut\b', r'\bpolice complaint\b', r'\baccount blocked\b', r'\bpenalty\b', r'\bchallan\b'
    ]
    detected_cues = [p.replace(r'\b', '') for p in urgency_patterns if re.search(p, lower)]
    has_urgency = len(detected_cues) > 0
    
    # Directionality & Perspective Analysis
    # Counterparty claim: Scammer says THEY transferred money, implying victim is awaiting credit
    counterparty_claims = [
        'bhej diya', 'bheja hai', 'bhej diye', 'i sent you', 'i have sent', 
        'refund approve', 'refund approved', 'credited to your'
    ]
    # Directives victim is asked to perform
    action_directives = ['pin dalo', 'enter pin', 'scan qr', 'scan karke', 'approve karke', 'accept karo']
    # Victim's genuine outgoing statements
    victim_outgoing = ['paying', 'send to', 'paid to', 'paying tea', 'paying snack', 'pay kar raha', 'transferring to']
    
    has_cp_claim = any(c in lower for c in counterparty_claims)
    has_directive = any(d in lower for d in action_directives)
    has_victim_send = any(v in lower for v in victim_outgoing)
    
    intent_type = "AMBIGUOUS"
    if has_negation:
        intent_type = "AMBIGUOUS"
    elif (has_cp_claim or ('refund' in lower and ('credit' in lower or 'approve' in lower))) and has_directive:
        intent_type = "RECEIVE"
    elif has_cp_claim:
        intent_type = "RECEIVE"
    elif has_victim_send and not has_cp_claim:
        intent_type = "SEND"
    elif 'pay' in lower and not has_cp_claim and not has_directive:
        intent_type = "SEND"
        
    return {
        "type": intent_type,
        "amount": amt,
        "has_urgency": has_urgency,
        "cues": detected_cues,
        "has_negation": has_negation
    }

def evaluate_disparity(msg, uri):
    parsed = parse_upi_uri(uri)
    if not parsed["is_valid"]:
        return "MALFORMED_PAYLOAD"
    
    intent = extract_intent(msg)
    
    amt_match = False
    if intent["amount"] is not None and parsed["am"] is not None:
        amt_match = abs(intent["amount"] - parsed["am"]) < 0.01
        
    # Urgency caution rule: Induces cognitive pause on coercion cues
    if intent["has_urgency"]:
        return "INSUFFICIENT_CONTEXT"
        
    # Reverse charge discrepancy rule
    if intent["type"] == "RECEIVE":
        # Critical if stated incoming matches technical debit payload exactly
        return "CRITICAL_INTENT_DISPARITY" if amt_match else "HIGH_INTENT_DISPARITY"
        
    if intent["type"] in ["AMBIGUOUS", "NONE"]:
        return "INSUFFICIENT_CONTEXT"
        
    # Outgoing payment alignment: if amount was mentioned, it must not mismatch
    if intent["type"] == "SEND":
        if intent["amount"] is not None and parsed["am"] is not None and not amt_match:
            return "HIGH_INTENT_DISPARITY"
        return "NO_DISPARITY_DETECTED"
        
    return "INSUFFICIENT_CONTEXT"

def run_suite():
    with open("test_fixtures.json", "r", encoding="utf-8-sig") as f:
        tests = json.load(f)
        
    tp = fp = tn = fn = 0
    correct = 0
    
    print("\n" + "="*76)
    print("      UPI SENTINEL: DISPARITY ENGINE DETERMINISTIC BENCHMARK (CLI)")
    print("="*76 + "\n")
    print(f"{'ID':<4} {'Scenario':<38} {'Expected':<22} {'Actual':<22} {'Result'}")
    print("-" * 76)
    
    for t in tests:
        v = evaluate_disparity(t["text"], t["uri"])
        is_pass = (v == t["expected_verdict"])
        if is_pass:
            correct += 1
            status = "PASS [✓]"
        else:
            status = "FAIL [✗]"
            
        print(f"#{t['id']:02d} {t['scenario']:<38} {t['expected_verdict']:<22} {v:<22} {status}")
        
        flagged = v in ["CRITICAL_INTENT_DISPARITY", "HIGH_INTENT_DISPARITY"]
        if t["is_deception"] and flagged:
            tp += 1
        elif not t["is_deception"] and flagged:
            fp += 1
        elif not t["is_deception"] and not flagged:
            tn += 1
        elif t["is_deception"] and not flagged:
            fn += 1

    precision = (tp / (tp + fp)) * 100 if (tp + fp) > 0 else None
    recall = (tp / (tp + fn)) * 100 if (tp + fn) > 0 else None
    accuracy = (correct / len(tests)) * 100 if len(tests) > 0 else 0.0
    
    print("\n" + "-"*76)
    print(f"  Exact-Verdict Match: {correct}/{len(tests)} ({accuracy:.1f}%)")
    print(f"  Threat Precision   : {f'{precision:.1f}%' if precision is not None else 'N/A'} (FP: {fp})")
    print(f"  Attack Recall      : {f'{recall:.1f}%' if recall is not None else 'N/A'} (FN: {fn})")
    print(f"  Confusion Matrix   : [TP: {tp}, FP: {fp}, TN: {tn}, FN: {fn}]")
    print("="*76 + "\n")
    
    if correct != len(tests):
        sys.exit(1)

if __name__ == "__main__":
    run_suite()
