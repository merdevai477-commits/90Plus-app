/**
 * R2 Bucket Information Checker
 * 
 * Quick script to check R2 bucket status and list existing files
 * 
 * Usage: ts-node check-r2-bucket.ts
 */

import { 
  S3Client, 
  ListObjectsV2Command,
  HeadBucketCommand,
  GetBucketLocationCommand 
} from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || process.env.R2_MEDIA_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.R2_MEDIA_PUBLIC_URL;

async function checkBucket() {
  console.log('\n' + '='.repeat(70));
  log('  Cloudflare R2 Bucket Information', colors.cyan);
  console.log('='.repeat(70) + '\n');

  // Check environment variables
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    log('❌ Missing R2 environment variables!', colors.red);
    console.log('\nRequired variables:');
    console.log(`  R2_ENDPOINT: ${R2_ENDPOINT ? '✓' : '✗'}`);
    console.log(`  R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID ? '✓' : '✗'}`);
    console.log(`  R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY ? '✓' : '✗'}`);
    console.log(`  R2_BUCKET_NAME: ${R2_BUCKET_NAME ? '✓' : '✗'}`);
    console.log(`  R2_PUBLIC_URL: ${R2_PUBLIC_URL ? '✓ (optional)' : '✗ (optional)'}`);
    process.exit(1);
  }

  // Display configuration
  log('📋 Configuration:', colors.blue);
  console.log(`  Endpoint: ${R2_ENDPOINT}`);
  console.log(`  Bucket: ${R2_BUCKET_NAME}`);
  console.log(`  Public URL: ${R2_PUBLIC_URL || 'Not configured'}`);
  console.log(`  Access Key: ***${R2_ACCESS_KEY_ID.slice(-4)}`);
  console.log('');

  // Create R2 client
  const client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  try {
    // Test connection
    log('🔌 Testing connection...', colors.yellow);
    await client.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
    log('✓ Connected successfully!', colors.green);
    console.log('');

    // List files by folder
    const folders = ['reels', 'thumbnails', 'avatars', 'covers', 'videos'];
    
    log('📁 Bucket Contents:', colors.blue);
    console.log('');

    let totalFiles = 0;
    let totalSize = 0;

    for (const folder of folders) {
      try {
        const command = new ListObjectsV2Command({
          Bucket: R2_BUCKET_NAME,
          Prefix: `${folder}/`,
          MaxKeys: 1000,
        });

        const response = await client.send(command);
        const fileCount = response.Contents?.length || 0;
        const folderSize = response.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0;

        totalFiles += fileCount;
        totalSize += folderSize;

        if (fileCount > 0) {
          log(`  📂 ${folder}/`, colors.cyan);
          console.log(`     Files: ${fileCount}`);
          console.log(`     Size: ${formatBytes(folderSize)}`);
          
          // Show first 5 files
          if (response.Contents && response.Contents.length > 0) {
            console.log(`     Recent files:`);
            response.Contents.slice(0, 5).forEach((obj, index) => {
              const fileName = obj.Key?.split('/').pop() || obj.Key;
              const fileSize = formatBytes(obj.Size || 0);
              const lastModified = obj.LastModified?.toLocaleDateString() || 'Unknown';
              console.log(`       ${index + 1}. ${fileName} (${fileSize}) - ${lastModified}`);
            });
            if (response.Contents.length > 5) {
              console.log(`       ... and ${response.Contents.length - 5} more files`);
            }
          }
          console.log('');
        } else {
          log(`  📂 ${folder}/`, colors.yellow);
          console.log(`     Empty`);
          console.log('');
        }
      } catch (err: any) {
        log(`  ❌ Error reading ${folder}/: ${err.message}`, colors.red);
        console.log('');
      }
    }

    // Summary
    console.log('='.repeat(70));
    log('  Summary', colors.cyan);
    console.log('='.repeat(70));
    console.log(`  Total Files: ${totalFiles}`);
    console.log(`  Total Size: ${formatBytes(totalSize)}`);
    console.log(`  Bucket: ${R2_BUCKET_NAME}`);
    console.log('');

    // Public URL test
    if (R2_PUBLIC_URL) {
      log('🌐 Public URL Configuration:', colors.blue);
      console.log(`  Base URL: ${R2_PUBLIC_URL}`);
      console.log(`  Example: ${R2_PUBLIC_URL}/reels/user-123/video.mp4`);
      console.log('');
    } else {
      log('⚠️  Public URL not configured', colors.yellow);
      console.log('  Set R2_PUBLIC_URL or R2_MEDIA_PUBLIC_URL to enable public access');
      console.log('');
    }

    console.log('='.repeat(70) + '\n');

  } catch (err: any) {
    log(`\n❌ Error: ${err.message}`, colors.red);
    console.error(err);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

checkBucket().catch(err => {
  log(`\n❌ Unexpected error: ${err.message}`, colors.red);
  console.error(err);
  process.exit(1);
});
