/**
 * External-services smoke test: Mux + Cloudflare R2.
 *
 * Run with: `npm run check:external`
 *
 * Mux checks:
 *  - Credentials valid (list assets, page size 1)
 *  - Direct upload URL can be created (proves write scope)
 *  - The upload is cancelled afterwards so it doesn't linger
 *
 * R2 checks (media bucket — uses R2_MEDIA_BUCKET_NAME or R2_BUCKET_NAME):
 *  - HeadBucket succeeds (credentials + bucket exist)
 *  - PutObject + GetObject + DeleteObject roundtrip on a temp key
 *  - Pre-signed GET URL can be generated (signing key works)
 *
 * Exits non-zero on any failure so this can be wired into CI later.
 */

import 'dotenv/config';
import Mux from '@mux/mux-node';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function mask(value: string | undefined, keep = 4): string {
  if (!value) return '<not set>';
  if (value.length <= keep * 2) return '***';
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

async function checkMux(): Promise<void> {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;

  console.log('\n[Mux] MUX_TOKEN_ID      =', mask(tokenId));
  console.log('[Mux] MUX_TOKEN_SECRET  =', mask(tokenSecret));
  console.log('[Mux] MUX_WEBHOOK_SECRET=', mask(webhookSecret));

  if (!tokenId || !tokenSecret) {
    throw new Error('MUX_TOKEN_ID / MUX_TOKEN_SECRET not set');
  }

  const mux = new Mux({ tokenId, tokenSecret });

  // 1. Read scope — list assets (page size 1).
  const assets = await mux.video.assets.list({ limit: 1 });
  const count = (assets as any)?.data?.length ?? 0;
  console.log(`[Mux] ✅ assets.list ok (page size 1, returned ${count})`);

  // 2. Write scope — create a direct upload, then cancel it immediately.
  const upload = await mux.video.uploads.create({
    cors_origin: '*',
    new_asset_settings: {
      playback_policy: ['public'],
      video_quality: 'basic',
      passthrough: JSON.stringify({ probe: 'connectivity-check' }),
    },
  });
  console.log(`[Mux] ✅ uploads.create ok — id=${upload.id}`);
  console.log(`[Mux]    upload URL starts with: ${upload.url.slice(0, 60)}…`);

  // Cancel the upload so it doesn't sit around forever waiting for bytes.
  try {
    await mux.video.uploads.cancel(upload.id);
    console.log('[Mux] ✅ uploads.cancel ok (cleaned up probe upload)');
  } catch (err: any) {
    console.log(`[Mux] ⚠ uploads.cancel failed (non-fatal): ${err?.message}`);
  }

  if (!webhookSecret) {
    console.log('[Mux] ⚠ MUX_WEBHOOK_SECRET not set — webhook signature verification will be skipped on the server');
  } else {
    console.log('[Mux] ✅ MUX_WEBHOOK_SECRET is present');
  }
}

async function checkR2(): Promise<void> {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName =
    process.env.R2_MEDIA_BUCKET_NAME ||
    process.env.R2_BUCKET_NAME;
  const publicBaseUrl = (
    process.env.R2_MEDIA_PUBLIC_URL ||
    process.env.R2_PUBLIC_URL ||
    ''
  ).replace(/\/$/, '');

  console.log('\n[R2] R2_ENDPOINT          =', endpoint ?? '<not set>');
  console.log('[R2] R2_ACCESS_KEY_ID     =', mask(accessKeyId));
  console.log('[R2] R2_SECRET_ACCESS_KEY =', mask(secretAccessKey));
  console.log('[R2] bucket               =', bucketName ?? '<not set>');
  console.log('[R2] public base url      =', publicBaseUrl || '<not set>');

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('R2 env vars incomplete (need ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET_NAME)');
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  // 1. HeadBucket — proves credentials + bucket are reachable.
  await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
  console.log(`[R2] ✅ HeadBucket("${bucketName}") ok`);

  // 2. PutObject — write a small probe key.
  const key = `_probe/connectivity-check-${Date.now()}.txt`;
  const payload = Buffer.from(`probe ${new Date().toISOString()}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: payload,
      ContentType: 'text/plain',
      CacheControl: 'no-store',
    }),
  );
  console.log(`[R2] ✅ PutObject ok — key=${key}`);

  // 3. GetObject — verify the contents round-trip.
  const got = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  const body = await got.Body?.transformToString();
  if (body !== payload.toString()) {
    throw new Error(`R2 roundtrip mismatch — expected "${payload.toString()}" got "${body}"`);
  }
  console.log('[R2] ✅ GetObject roundtrip matches');

  // 4. Pre-signed GET URL — proves signing scope (used for private reels).
  const signed = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName, Key: key }), {
    expiresIn: 60,
  });
  console.log(`[R2] ✅ getSignedUrl ok — ${signed.slice(0, 80)}…`);

  // 5. DeleteObject — clean up the probe so the bucket stays tidy.
  await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
  console.log('[R2] ✅ DeleteObject ok (probe removed)');
}

(async () => {
  let failed = false;
  try {
    await checkMux();
  } catch (err: any) {
    failed = true;
    console.error('\n[Mux] ❌', err?.message ?? err);
    if (err?.status) console.error('[Mux]   HTTP', err.status);
  }

  try {
    await checkR2();
  } catch (err: any) {
    failed = true;
    console.error('\n[R2] ❌', err?.name, err?.message ?? err);
    if (err?.$metadata?.httpStatusCode) {
      console.error('[R2]   HTTP', err.$metadata.httpStatusCode);
    }
  }

  console.log('');
  if (failed) {
    console.error('❌ External-services check FAILED');
    process.exit(1);
  } else {
    console.log('✅ Mux + R2 connectivity OK');
    process.exit(0);
  }
})();
