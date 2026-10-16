export const DEMO_PRESETS = [
  {
    id: 'olx',
    label: { en: 'Army OLX Scam', hi: 'आर्मी OLX स्कैम' },
    tag: { en: 'Critical Trap', hi: 'धोखाधड़ी का खतरा' },
    tagColor: 'text-rose-400 border-rose-800 bg-rose-950/60',
    message: 'advance Rs 5000 bhej diye hain OLX table ke liye. QR scan karke PIN dalo aur accept karo.',
    uri: 'upi://pay?pa=fakeofficer99@ybl&pn=Army%20HQ%20Canteen&am=5000&cu=INR&mode=02',
    expected: 'CRITICAL_INTENT_DISPARITY'
  },
  {
    id: 'discom',
    label: { en: 'Bijli Cut Urgency', hi: 'बिजली कट की धमकी' },
    tag: { en: 'High Caution', hi: 'सावधान रहें' },
    tagColor: 'text-amber-400 border-amber-800 bg-amber-950/60',
    message: 'URGENT NOTICE: Power disconnected tonight by 9:30 PM due to unpaid bill.Pay Rs 120 immediately.',
    uri: 'upi://pay?pa=discom.billdesk@icici&pn=Discom%20Power&am=120&cu=INR',
    expected: 'HIGH_INTENT_DISPARITY'
  },
  {
    id: 'kirana',
    label: { en: 'Kirana Store Milk', hi: 'किराना दुकान बिल' },
    tag: { en: 'No Red Flags', hi: 'कोई खतरा नहीं दिखा' },
    tagColor: 'text-emerald-400 border-emerald-800 bg-emerald-950/60',
    message: 'Doodh aur bread ka bill pay kar raha hu Rs 110.',
    uri: 'upi://pay?pa=guptakirana@icici&pn=Gupta%20General%20Store&am=110&cu=INR',
    expected: 'NO_DISPARITY_DETECTED'
  }
];
