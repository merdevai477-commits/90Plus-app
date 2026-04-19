/**
 * Delete file from R2 bucket
 * Usage: npx tsx scripts/r2-delete-file.ts <r2-key>
 */

import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

async function deleteFile(r2Key: string) {
  try {
    console.log(`\n🗑️  Deleting: ${r2Key}\n`);

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: r2Key,
    });

    await client.send(command);
    
    console.log('✅ File deleted successfully!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const r2Key = process.argv[2];

if (!r2Key) {
  console.error('Usage: npx tsx scripts/r2-delete-file.ts <r2-key>');
  process.exit(1);
}

deleteFile(r2Key);
