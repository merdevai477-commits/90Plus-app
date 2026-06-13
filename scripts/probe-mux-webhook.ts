/**
 * End-to-end probe: sign a fake Mux webhook and POST to production.
 * Usage: npx tsx scripts/probe-mux-webhook.ts [url]
 */
import 'dotenv/config';
import crypto from 'crypto';

const url = process.argv[2] || 'https://90plus.pro/api/webhooks/mux';
const secret = process.env.MUX_WEBHOOK_SECRET;

function signMuxWebhook(body: string, webhookSecret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}.${body}`;
  const sig = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

async function main() {
  if (!secret) {
    console.error('MUX_WEBHOOK_SECRET not set in .env');
    process.exit(1);
  }

  const body = JSON.stringify({
    type: 'video.upload.asset_created',
    data: { id: 'probe-asset', upload_id: 'probe-upload' },
  });

  const sigHeader = signMuxWebhook(body, secret);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'mux-signature': sigHeader,
    },
    body,
  });

  const text = await res.text();
  console.log(`POST ${url}`);
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${text.slice(0, 500)}`);

  if (res.status === 200) {
    console.log('\n✅ Webhook URL + MUX_WEBHOOK_SECRET match production');
    process.exit(0);
  }
  if (res.status === 401) {
    console.log('\n❌ Signature rejected — MUX_WEBHOOK_SECRET on Railway may differ from .env');
    process.exit(1);
  }
  console.log('\n⚠ Unexpected status — check Railway logs');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
