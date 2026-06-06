#!/usr/bin/env npx tsx
/**
 * Verify Clerk production setup for 90Plus.
 * Run: npx tsx scripts/clerk-verify-production.ts
 */
import dotenv from 'dotenv';

dotenv.config();

const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
const PK_LIVE_PREFIX = 'pk_live_';

async function main() {
  const issues: string[] = [];
  const ok: string[] = [];

  if (!CLERK_SECRET?.startsWith('sk_live_')) {
    issues.push('CLERK_SECRET_KEY locally is not sk_live_');
  } else {
    ok.push('Local CLERK_SECRET_KEY is sk_live');
  }

  const envRes = await fetch('https://clerk.90plus.pro/v1/environment');
  const env = (await envRes.json()) as {
    display_config?: {
      application_name?: string;
      sign_in_url?: string;
      logo_image_url?: string;
      instance_environment_type?: string;
    };
    auth_config?: { test_mode?: boolean };
  };

  if (env.auth_config?.test_mode) {
    issues.push('Clerk instance is still in test_mode');
  } else {
    ok.push('Clerk production instance (test_mode=false)');
  }

  const appName = env.display_config?.application_name ?? '';
  if (!appName.includes('90Plus')) {
    issues.push(`Clerk application_name is "${appName}" — set to "90Plus" in Dashboard → Branding`);
  } else {
    ok.push(`Clerk application_name: ${appName}`);
  }

  if (env.display_config?.sign_in_url?.includes('accounts.90plus.pro')) {
    ok.push('Account portal: accounts.90plus.pro');
  } else {
    issues.push('sign_in_url is not accounts.90plus.pro');
  }

  if (CLERK_SECRET) {
    const redirects = (await fetch('https://api.clerk.com/v1/redirect_urls', {
      headers: { Authorization: `Bearer ${CLERK_SECRET}` },
    }).then((r) => r.json())) as Array<{ url: string }>;

    const required = ['ninetyplus://auth-callback', 'ninetyplus://'];
    for (const url of required) {
      if (redirects.some((r) => r.url === url)) ok.push(`Redirect URL registered: ${url}`);
      else issues.push(`Missing Clerk redirect URL: ${url}`);
    }
  }

  const webhook = await fetch('https://90plus.pro/api/webhooks/clerk/health').then((r) => r.json());
  if (webhook.webhookSecretConfigured) ok.push('Railway CLERK_WEBHOOK_SECRET configured');
  else issues.push('CLERK_WEBHOOK_SECRET missing on Railway');

  console.log('\n=== 90Plus Clerk Production Check ===\n');
  ok.forEach((line) => console.log('✅', line));
  issues.forEach((line) => console.log('❌', line));

  const logoUrl = env.display_config?.logo_image_url;
  if (logoUrl) {
    ok.push(`Clerk branding logo configured (${logoUrl.slice(0, 60)}…)`);
  }

  console.log('\n=== Google OAuth: اسم + لوجو "Clerk" (يدوي) ===');
  console.log('شاشة Google (accounts.google.com) تعرض لوجo Clerk حتى تضيف credentials خاصة:');
  console.log('1. Google Cloud → OAuth consent screen → App name: 90Plus + logo: public/90Plus.png');
  console.log('2. OAuth Client (Web) → redirect: https://clerk.90plus.pro/v1/oauth_callback');
  console.log('3. Clerk Dashboard → SSO → Google → Use custom credentials');
  console.log('4. Publish OAuth app + Google verification للوجo');
  console.log('5. Clerk Dashboard → Branding → logo 90Plus (لصفحات accounts.90plus.pro)');
  console.log('\nSee: scripts/CLERK_GOOGLE_OAUTH.md\n');

  process.exit(issues.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
