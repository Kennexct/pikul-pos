import type { Mailer, ReceiptMail } from './types';

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** `"Toko Sari via Pikul" <struk@pikul.id>` from MAIL_FROM's address; quotes, brackets and line breaks are dropped from the shop name. */
export function receiptFrom(mailFrom: string, shopName: string): string {
  const addr = /<([^>]+)>/.exec(mailFrom)?.[1] ?? mailFrom.trim();
  const name = shopName.replace(/["<>\\\r\n]/g, '').trim().slice(0, 60);
  return name ? `"${name} via Pikul" <${addr}>` : `Pikul <${addr}>`;
}

export function resendMailer(apiKey: string, from: string, fetchFn: typeof fetch = fetch): Mailer {
  return {
    async sendLoginCode(email, code) {
      const res = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [email],
          subject: `Kode masuk Pikul: ${code}`,
          text: `Kode masuk Pikul Anda: ${code}\n\nBerlaku 10 menit. Abaikan email ini jika Anda tidak meminta kode.\n\nYour Pikul sign-in code: ${code} (valid for 10 minutes).`,
          html: `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#0f1a16"><p>Kode masuk Pikul Anda:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#0b7a5a">${code}</p><p>Berlaku 10 menit. Abaikan email ini jika Anda tidak meminta kode.</p><p style="color:#5b6862;font-size:13px">Your Pikul sign-in code, valid for 10 minutes.</p></div>`,
        }),
      });
      if (!res.ok) throw new Error(`resend_${res.status}`);
    },
    async sendReceipt(m: ReceiptMail) {
      const res = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: receiptFrom(from, m.fromName),
          to: [m.to],
          ...(m.replyTo ? { reply_to: m.replyTo } : {}),
          subject: m.subject,
          html: m.html,
          text: m.text,
          attachments: [{ filename: m.fileName, content: b64(m.png) }],
        }),
      });
      if (!res.ok) throw new Error(`resend_${res.status}`);
    },
  };
}

/** Dev only: prints the code to the Functions log instead of sending it. */
export const consoleMailer: Mailer = {
  async sendLoginCode(email, code) {
    console.log(`[dev mail] login code for ${email}: ${code}`);
  },
  async sendReceipt(m) {
    console.log(`[dev mail] receipt "${m.subject}" to ${m.to}`);
  },
};
