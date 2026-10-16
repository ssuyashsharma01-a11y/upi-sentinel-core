export const DOJO_SCENARIOS = [
  {
    id: 'olx_advance',
    title: 'OLX Military Officer Advance Trap',
    tag: 'Reverse Charge / Buyer Fraud',
    difficulty: 'Easy',
    context: 'Tumne ek purana sofa OLX par post kiya. Ek buyer "Army Officer" banke bolta hai wo immediate transfer kar raha hai bina inspection ke.',
    message: 'Maine advance bhej diya hai ₹10,000. Yeh QR code scan karo, PIN daal kar account me funds credit approve karo.',
    uri: 'upi://pay?pa=armyofficer.hq@okhdfcbank&pn=ArmyCanteenFund&am=10000&cu=INR',
    forensicClues: [
      'Official army entity spoofed on a consumer PSP handle (@okhdfcbank).',
      'Direct order to enter UPI PIN to "receive/credit" money.',
      'Reverse charge intent disparity: upi://pay hamesha debit karta hai, credit nahi.'
    ],
    correctAction: 'REJECT_AND_BLOCK',
    explanation: 'UPI me paise lene ke liye kabhi bhi UPI PIN enter nahi karna padta. QR scan karke PIN daalna hamesha account se debit karwata hai.'
  },
  {
    id: 'kyc_expiry',
    title: 'Bank Account & SIM KYC Deactivation Coercion',
    tag: 'Urgency & Impersonation',
    difficulty: 'Medium',
    context: 'SMS aata hai ki tumhara bank account aaj raat 9:30 baje suspend ho jayega KYC update na hone ki wajah se.',
    message: 'URGENT NOTICE! Dear customer your SBI a/c is blocked today. Re-verify KYC now by paying ₹1 token fee via link or visit immediate: upi://pay',
    uri: 'upi://pay?pa=sbikyc.verification92@paytm&pn=StateBankSupport&am=1&cu=INR',
    forensicClues: [
      'Intimidation keyword "URGENT NOTICE / blocked today".',
      'Consumer @paytm handle pretending to be official State Bank of India support.',
      'Token fee trap: Ek baar authorization lene ke baad session hijack ya auto-mandate approve karwate hain.'
    ],
    correctAction: 'REPORT_FRAUD',
    explanation: 'Banks kabhi bhi SMS/WhatsApp par UPI link bhej kar KYC renewal ya token fee nahi mangte. Official banking app ya branch jana chahiye.'
  },
  {
    id: 'discom_cutoff',
    title: 'Urgent Discom Electricity Power Cutoff',
    tag: 'Social Engineering / Intimidation',
    difficulty: 'Medium',
    context: 'Garmiyon ki shaam ko message aata hai ki pichle mahine ka bill unpaid hai aur 1 ghante me power cut ho jayegi.',
    message: 'Electricity Dept Alert: Your power will be disconnected at 8:30 PM due to unpaid bill ₹1,450. Contact officer immediately & clear dues: scan QR.',
    uri: 'upi://pay?pa=discom.officer.deshmukh@ybl&pn=DiscomBillingDesk&am=1450&cu=INR',
    forensicClues: [
      'Artificial deadline designed to induce cognitive panic ("8:30 PM power cutoff").',
      'Personal consumer UPI handle (@ybl) instead of an official BBPS corporate merchant collection handle.',
      'Missing Bill reference number or consumer CA number.'
    ],
    correctAction: 'REJECT_AND_BLOCK',
    explanation: 'Discoms power cut warning ke liye SMS me direct personal UPI ID nahi bhejte. Utility bills hamesha official Discom portal ya BBPS-enabled apps se hi bharne chahiye.'
  },
  {
    id: 'kbc_lottery',
    title: 'KBC Lottery / Mega Reward Voucher',
    tag: 'Greed Incentive / Advance Fee',
    difficulty: 'Easy',
    context: 'WhatsApp par ek decorated banner aata hai jisme KBC aur Amitabh Bachchan ki photo lagi hai aur ₹25,00,000 cash prize claim karne ko kaha gaya hai.',
    message: 'Badhai ho! Aapka number KBC Lucky Draw me ₹25 Lakh jeeta hai. Government Tax/Processing charge ₹3,500 jama karein aur prize release paayein.',
    uri: 'upi://pay?pa=kbcluckydraw.desk2026@ibl&pn=LotteryDisbursement&am=3500&cu=INR',
    forensicClues: [
      'Classic "Advance Fee Fraud" (Lottery claim karne ke liye pehle tax do).',
      'Lottery/KBC keywords combined with consumer PSP (@ibl).',
      'Unsolicited reward for a contest tumne kabhi join hi nahi kiya.'
    ],
    correctAction: 'REPORT_FRAUD',
    explanation: 'KBC ya koi bhi valid institution lottery release karne ke liye kisi personal UPI ID par advance processing tax nahi mangta.'
  },
  {
    id: 'digital_arrest',
    title: 'Fake Narcotics Bureau & Police Digital Arrest',
    tag: 'High-Pressure Coercion',
    difficulty: 'Hard',
    context: 'Ek formal call/message aata hai claiming tumhare Aadhaar se ek parcel book hua tha jisme illegal contraband paya gaya hai, aur Supreme Court case registered hai.',
    message: 'Police Cyber Cell & Narcotics Bureau: Non-bailable warrant issued under PMLA. Pay refundable verification deposit ₹25,000 for immediate asset audit clearance.',
    uri: 'upi://pay?pa=cybercell.police.verification@axl&pn=AuditEscrowDesk&am=25000&cu=INR',
    forensicClues: [
      'Fake "Digital Arrest" coercion — legal process me aisi koi custody nahi hoti.',
      'Demand for "refundable audit verification deposit" on a personal private VPA.',
      'Fear-inducing legal jargon designed to bypass logical deliberation.'
    ],
    correctAction: 'REPORT_FRAUD',
    explanation: 'Police, CBI ya Court kabhi bhi WhatsApp call ya UPI ke zariye "Digital Arrest" ya "Refundable Verification Deposit" nahi lete. Yeh standard extortion scam hai.'
  }
];
