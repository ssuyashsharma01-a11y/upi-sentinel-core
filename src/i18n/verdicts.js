export const SIGNAL_I18N = {
  REVERSE_CHARGE_SIGNAL: {
    en: 'Incoming payment claim on debit request',
    hi: 'पैसे आने का दावा पर लिंक डेबिट का है'
  },
  DIRECTIVE_PIN_ENTRY: {
    en: 'Instructs you to enter PIN',
    hi: 'पिन डालने का निर्देश'
  },
  COERCIVE_ACCEPT_TRAP: {
    en: 'Coerces you to accept without PIN',
    hi: 'बिना पिन डाले एक्सेप्ट करने का दबाव'
  },
  URGENCY_INTIMIDATION: {
    en: 'Urgent cutoff intimidation threat',
    hi: 'तुरंत बिजली/सेवा कटने की धमकी'
  },
  IMPERSONATION_RISK: {
    en: 'Official entity on consumer PSP ID',
    hi: 'सरकारी नाम, निजी यूपीआई हैंडल'
  },
  HOMOGRAPH_ATTACK: {
    en: 'Hidden foreign lookalike characters in VPA',
    hi: 'यूपीआई आईडी में नकली विदेशी अक्षर'
  },
  AMOUNT_MISMATCH: {
    en: 'Amount discrepancy between message and QR',
    hi: 'मैसेज और क्यूआर की रकम में अंतर'
  },
  UNCORROBORATED_ADVANCE: {
    en: 'Unspecified advance transfer claim',
    hi: 'बिना रकम लिखे एडवांस भेजने का दावा'
  },
  INTENT_USER_OUTGOING: {
    en: 'Legitimate direct outgoing payment',
    hi: 'सामान्य बिल या खरीदारी भुगतान'
  },
  AWARENESS_ADVISORY: {
    en: 'Official security awareness notice',
    hi: 'आधिकारिक सुरक्षा जागरूकता संदेश'
  },
  MALFORMED_URI: {
    en: 'Corrupted payload structure',
    hi: 'दूषित या टूटा हुआ लिंक'
  },
  MISSING_PA: {
    en: 'Missing recipient address (pa)',
    hi: 'प्राप्तकर्ता का पता गायब'
  },
  CURRENCY_MISMATCH: {
    en: 'Non-INR currency requested',
    hi: 'विदेशी मुद्रा का अनुरोध'
  }
};

export const VERDICT_I18N = {
  CRITICAL_INTENT_DISPARITY: {
    badge: { en: 'CRITICAL TRAP', hi: 'धोखाधड़ी का खतरा' },
    title: { en: 'Reverse-Charge Scam Detected', hi: 'रिवर्स-चार्ज स्कैम पकड़ा गया!' },
    oneLiner: (amount) => ({
      en: `Your account will be DEBITED ${amount ? `₹${amount}` : 'funds'}. Entering your PIN gives money, never receives it.`,
      hi: `आपके खाते से ${amount ? `₹${amount}` : 'पैसे'} कट जाएंगे! पैसे पाने या रिफंड के लिए कभी पिन नहीं लगता।`
    }),
    actionText: {
      en: 'STOP! Do not enter your UPI PIN. This is a debit request.',
      hi: 'रुकें! अपना UPI PIN न डालें। यह पैसे काटने का अनुरोध है।'
    },
    reason: {
      en: 'Sender claimed funds were sent/refunded or told you to enter PIN, but this link debits your account.',
      hi: 'सामने वाले ने पैसे भेजने का दावा किया पर लिंक आपके खाते से पैसे काटने के लिए बनाया गया है।'
    },
    recommendation: {
      en: 'Immediately decline request and block this contact.',
      hi: 'अनुरोध को तुरंत रद्द करें और इस नंबर को ब्लॉक करें।'
    }
  },
  HIGH_INTENT_DISPARITY: {
    badge: { en: 'HIGH DISPARITY', hi: 'संदिग्ध विसंगति' },
    title: { en: 'Suspicious Request Flagged', hi: 'संदिग्ध भुगतान अनुरोध' },
    oneLiner: (amount) => ({
      en: `High risk detected. Coercive urgency, unverified handle, or amount mismatch found.`,
      hi: `संदिग्ध लिंक मिला है। बिजली कटने की धमकी, फर्जी हैंडल या रकम में अंतर पाया गया है।`
    }),
    actionText: {
      en: 'Do not pay via this link. Verify independently on official portals.',
      hi: 'इस लिंक पर भुगतान न करें। केवल आधिकारिक ऐप या पोर्टल पर जांचें।'
    },
    reason: {
      en: 'Threat intimidation, unverified entity impersonation, or mismatched transaction terms.',
      hi: 'जल्दबाजी दिखाने, संस्था का नाम चुराने या बिल विवरण में विसंगति के संकेत।'
    },
    recommendation: {
      en: 'Check your official utility portal or contact verified customer care.',
      hi: 'सीधे आधिकारिक संस्था के ऐप में जाकर बिल की स्थिति देखें।'
    }
  },
  INSUFFICIENT_CONTEXT: {
    badge: { en: 'PROCEED WITH CAUTION', hi: 'सावधानी से आगे बढ़ें' },
    title: { en: 'Uncorroborated Payment Request', hi: 'अपुष्ट भुगतान अनुरोध' },
    oneLiner: () => ({
      en: 'No explicit payment intent found in message to corroborate this debit payload.',
      hi: 'भुगतान के उद्देश्य की पुष्टि के लिए संदेश में पर्याप्त संदर्भ मौजूद नहीं है।'
    }),
    actionText: {
      en: 'Verify payee identity independently before entering PIN.',
      hi: 'पिन डालने से पहले प्राप्तकर्ता की पहचान स्वयं सत्यापित करें।'
    },
    reason: {
      en: 'Context is missing, generic, or an uncorroborated forward.',
      hi: 'मैसेज में भुगतान का कोई स्पष्ट कारण नहीं मिला।'
    },
    recommendation: {
      en: 'Only proceed if you personally recognize the payee name.',
      hi: 'केवल तभी आगे बढ़ें यदि आप प्राप्तकर्ता को व्यक्तिगत रूप से जानते हों।'
    }
  },
  NO_DISPARITY_DETECTED: {
    badge: { en: 'NO RED FLAGS', hi: 'कोई खतरा नहीं दिखा' },
    title: { en: 'Standard Payment Request', hi: 'सामान्य भुगतान अनुरोध' },
    oneLiner: (amount, payee) => ({
      en: `You are paying ${amount ? `₹${amount}` : 'money'} to ${payee}.`,
      hi: `आप ${payee} को ${amount ? `₹${amount}` : 'रुपये'} भेज रहे हैं।`
    }),
    actionText: {
      en: 'No red flags detected. Still verify payee name in your UPI app before PIN entry.',
      hi: 'कोई खतरा नहीं दिखा। फिर भी पिन डालने से पहले अपने UPI ऐप में प्राप्तकर्ता का नाम जांच लें।'
    },
    reason: {
      en: 'Legitimate direct outgoing payment pattern matching user context.',
      hi: 'मैसेज और लिंक दोनों आपके द्वारा पैसे भेजने के उद्देश्य से मेल खाते हैं।'
    },
    recommendation: {
      en: 'Confirm recipient name on your bank screen before PIN authorization.',
      hi: 'पिन डालने से पहले बैंक स्क्रीन पर प्राप्तकर्ता का नाम अवश्य जांचें।'
    }
  },
  MALFORMED_PAYLOAD: {
    badge: { en: 'INVALID LINK', hi: 'अमान्य लिंक' },
    title: { en: 'Invalid UPI Payload', hi: 'अमान्य यूपीआई लिंक' },
    oneLiner: () => ({
      en: 'The provided QR or link is corrupted or missing standard UPI format.',
      hi: 'यह लिंक या क्यूआर कोड वैध यूपीआई प्रारूप में नहीं है।'
    }),
    actionText: {
      en: 'Do not authorize. Link format unreadable.',
      hi: 'भुगतान न करें। लिंक अमान्य या दूषित है।'
    },
    reason: {
      en: 'Missing mandatory VPA parameter or corrupted URI scheme.',
      hi: 'अनिवार्य यूपीआई पता गायब है या लिंक टूटा हुआ है।'
    },
    recommendation: {
      en: 'Ask the merchant for a fresh QR sticker.',
      hi: 'दुकानदार से साफ क्यूआर कोड स्कैन करने को कहें।'
    }
  }
};
