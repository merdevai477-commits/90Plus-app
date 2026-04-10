#!/usr/bin/env ts-node
/**
 * Quick R2 Connection Test
 * 
 * Simple 30-second test to verify R2 is working
 * 
 * Usage: ts-node quick-test-r2.ts
 */

import { S3Client, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

async function quickTest() {
  console.log(`\n${colors.cyan}🚀 Quick R2 Test (30 seconds)${colors.reset}\n`);

  // Check env vars
  const endpoint = process.env.R2_ENDPOINT;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || process.env.R2_MEDIA_BUCKET_NAME;

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    console.log(`${colors.red}❌ Missing R2 environment variables in .env${colors.reset}`);
    console.log(`\nRequired:`);
    console.log(`  R2_ENDPOINT=${endpoint ? '✓' : '✗'}`);
    console.log(`  R2_ACCESS_KEY_ID=${accessKey ? '✓' : '✗'}`);
    console.log(`  R2_SECRET_ACCESS_KEY=${secretKey ? '✓' : '✗'}`);
    console.log(`  R2_BUCKET_NAME=${bucket ? '✓' : '✗'}\n`);
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  try {
    // Test 1: Connection
    process.stdout.write('1. Testing connection... ');
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`${colors.green}✓${colors.reset}`);

    // Test 2: Upload
    process.stdout.write('2. Testing upload... ');
    const testKey = `test/quick-test-${Date.now()}.txt`;
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: Buffer.from('Quick test file'),
      ContentType: 'text/plain',
    }));
    console.log(`${colors.green}✓${colors.reset}`);

    // Test 3: Delete
    process.stdout.write('3. Testing delete... ');
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }));
    console.log(`${colors.green}✓${colors.reset}`);

    // Success
    console.log(`\n${colors.green}✅ All tests passed! R2 is working correctly.${colors.reset}`);
    console.log(`\nBucket: ${bucket}`);
    console.log(`Endpoint: ${endpoint}\n`);

  } catch (err: any) {
    console.log(`${colors.red}✗${colors.reset}`);
    console.log(`\n${colors.red}❌ Test failed: ${err.message}${colors.reset}\n`);
    process.exit(1);
  }
}

quickTest();
