/**
 * Upload file to R2 bucket
 * Usage: npx tsx scripts/r2-upload-file.ts <local-file-path> <r2-key>
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function uploadFile(localPath: string, r2Key: string) {
  try {
    if (!fs.existsSync(localPath)) {
      console.error(`❌ File not found: ${localPath}`);
      process.exit(1);
    }

    const fileBuffer = fs.readFileSync(localPath);
    const fileSize = (fileBuffer.length / 1024).toFixed(2);

    console.log(`\n📤 Uploading: ${localPath}`);
    console.log(`📦 To: ${r2Key}`);
    console.log(`📊 Size: ${fileSize} KB\n`);

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: r2Key,
      Body: fileBuffer,
    });

    await client.send(command);
    
    const publicUrl = process.env.R2_PUBLIC_URL 
      ? `${process.env.R2_PUBLIC_URL}/${r2Key}`
      : `https://${process.env.R2_BUCKET_NAME}.r2.dev/${r2Key}`;

    console.log('✅ Upload successful!');
    console.log(`🔗 URL: ${publicUrl}\n`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const localPath = process.argv[2];
const r2Key = process.argv[3];

if (!localPath || !r2Key) {
  console.error('Usage: npx tsx scripts/r2-upload-file.ts <local-file-path> <r2-key>');
  process.exit(1);
}

uploadFile(localPath, r2Key);
