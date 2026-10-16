export const config = {
  runtime: 'edge',
};

export default function handler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const amount = searchParams.get('am') || '';
    const payee = searchParams.get('pn') || 'संदिग्ध खाता';
    const scamType = searchParams.get('type') || 'रिवर्स-चार्ज धोखाधड़ी';
    const lang = searchParams.get('lang') || 'hi';

    const titleText = amount 
      ? `⚠️ सावधान: -₹${amount} का फर्जी यूपीआई ट्रैप पकड़ा गया!`
      : `⚠️ सावधान: फर्जी यूपीआई पेमेंट ट्रैप पकड़ा गया!`;

    const subText = `प्राप्तकर्ता: ${payee} · कारण: ${scamType}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="utf-8">
        <title>${titleText}</title>
        <meta property="og:title" content="${titleText}" />
        <meta property="og:description" content="${subText} · UPI Sentinel द्वारा ऑन-डिवाइस जांचा गया।" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="UPI Sentinel" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${titleText}" />
        <meta name="twitter:description" content="${subText}" />
        <style>
          body {
            background-color: #050811;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 24px;
            box-sizing: border-box;
          }
          .card {
            background: #120306;
            border: 2px solid #f43f5e;
            border-radius: 28px;
            padding: 36px 30px;
            max-width: 480px;
            width: 100%;
            text-align: center;
            box-shadow: 0 0 50px rgba(244, 63, 94, 0.35);
          }
          .badge {
            display: inline-block;
            background: rgba(244, 63, 94, 0.2);
            border: 1px solid #f43f5e;
            color: #fb7185;
            font-size: 13px;
            font-weight: 800;
            padding: 6px 14px;
            border-radius: 9999px;
            letter-spacing: 1px;
            margin-bottom: 20px;
          }
          .amount {
            font-size: 48px;
            font-weight: 900;
            color: #fb7185;
            margin: 10px 0;
            font-family: monospace;
          }
          .headline {
            font-size: 22px;
            font-weight: 900;
            line-height: 1.3;
            margin-bottom: 12px;
          }
          .details {
            font-size: 14px;
            color: #cbd5e1;
            margin-bottom: 24px;
            line-height: 1.5;
          }
          .btn {
            display: block;
            background: linear-gradient(90deg, #06b6d4, #3b82f6);
            color: #000000;
            font-weight: 900;
            padding: 16px 20px;
            border-radius: 16px;
            text-decoration: none;
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">UPI SENTINEL ALERT</div>
          ${amount ? `<div class="amount">−₹${amount}</div>` : ''}
          <div class="headline">${titleText}</div>
          <div class="details">${subText}<br><strong>नियम:</strong> पैसे प्राप्त करने या रिफंड के लिए कभी भी UPI PIN दर्ज न करें!</div>
          <a class="btn" href="https://upi-sentinel-core.vercel.app">खुद अपना QR / लिंक चेक करें</a>
        </div>
      </body>
      </html>
    `;

    return new Response(htmlContent, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err) {
    return new Response('UPI Sentinel Preview Card', { status: 200 });
  }
}
