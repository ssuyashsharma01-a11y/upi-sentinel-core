import re

# Fix #5: Full Devanagari digit translation table mapping (including '?')
DEVANAGARI_DIGITS = "??????????"
ENGLISH_DIGITS = "0123456789"
TRANSLATION_TABLE = str.maketrans(DEVANAGARI_DIGITS, ENGLISH_DIGITS)

def normalize_text(text: str) -> str:
    if not text:
        return ""
    # Translate Devanagari numerals to standard ASCII numerals
    return text.translate(TRANSLATION_TABLE)

def evaluate_transaction(upi_uri: str, claimed_action: str, context_message: str):
    normalized_msg = normalize_text(context_message)
    reasons = []
    score = 10
    
    # Broad receive intent detection rules
    receive_keywords = [
        "receive", "refund", "cashback", "prize", "credited", "claim", 
        "get money", "bhej diya", "bhejdiya", "bheja", "won", "won a lottery"
    ]
    
    msg_lower = normalized_msg.lower()
    has_receive_intent = any(kw in msg_lower for kw in receive_keywords)
    is_receive_claim = claimed_action == "RECEIVE" or has_receive_intent
    has_debit_mode = "mode=02" in upi_uri or "am=" in upi_uri

    if is_receive_claim and has_debit_mode:
        score += 65
        reasons.append("CONTEXT CONTRADICTION: Message promises incoming funds/refund, but URI requests an outgoing payment/debit.")

    # Word-boundary impersonation check
    restricted_terms = re.compile(r'\b(rbi|rto|army|kbc|cyber cell)\b', re.IGNORECASE)
    if restricted_terms.search(msg_lower) or restricted_terms.search(upi_uri):
        score = max(score, 60)
        reasons.append("IMPERSONATION RISK: Potential authoritative entity reference detected using strict word boundaries.")

    if not reasons:
        score = 15
        reasons.append("No severe contradictions or anomalies found against standard payload parameters.")

    risk_level = "HIGH_RISK" if score >= 70 else ("CAUTION" if score >= 35 else "LOW_RISK")
    title = "High Risk Disparity Detected" if score >= 70 else ("Moderate Context Caution" if score >= 35 else "Structure Clean")

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "warning_title": title,
        "reasons": reasons,
        "action_advice": "STOP: Do not enter your UPI PIN. Verify request details independently." if score >= 70 else "Proceed with standard user caution."
    }
