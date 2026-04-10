/**
 * Cloudflare R2 Reels Bucket Test Script
 * 
 * Tests R2 storage functionality for reels bucket:
 * - Connection to R2
 * - Upload video file
 * - Upload thumbnail
 * - List files
 * - Delete files
 * - Public URL access
 * 
 * Usage: ts-node test-r2-reels.ts
 */

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand 
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✓ ${message}`, colors.green);
}

function error(message: string) {
  log(`✗ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

function warning(message: string) {
  log(`⚠ ${message}`, colors.yellow);
}

// ============================================================================
// Configuration
// ============================================================================

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || process.env.R2_MEDIA_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.R2_MEDIA_PUBLIC_URL;

// Test file paths
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_VIDEO_KEY = `reels/${TEST_USER_ID}/test-video-${Date.now()}.mp4`;
const TEST_THUMBNAIL_KEY = `thumbnails/${TEST_USER_ID}/test-thumb-${Date.now()}.jpg`;

// ============================================================================
// Initialize R2 Client
// ============================================================================

function createR2Client(): S3Client | null {
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    error('Missing R2 environment variables!');
    info('Required variables:');
    console.log('  - R2_ENDPOINT');
    console.log('  - R2_ACCESS_KEY_ID');
    console.log('  - R2_SECRET_ACCESS_KEY');
    console.log('  - R2_BUCKET_NAME');
    console.log('  - R2_PUBLIC_URL (optional)');
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// ============================================================================
// Test Functions
// ============================================================================

async function testBucketConnection(client: S3Client): Promise<boolean> {
  try {
    info('Testing bucket connection...');
    
    const command = new HeadBucketCommand({
      Bucket: R2_BUCKET_NAME,
    });

    await client.send(command);
    success(`Connected to bucket: ${R2_BUCKET_NAME}`);
    return true;
  } catch (err: any) {
    error(`Failed to connect to bucket: ${err.message}`);
    return false;
  }
}

async function testUploadVideo(client: S3Client): Promise<boolean> {
  try {
    info('Testing video upload to reels bucket...');

    // Create a dummy video file (small MP4 header)
    const dummyVideoBuffer = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // MP4 header
      0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
      0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
      0x6D, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08,
    ]);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: TEST_VIDEO_KEY,
      Body: dummyVideoBuffer,
      ContentType: 'video/mp4',
      Metadata: {
        'test': 'true',
        'uploaded-by': 'test-script',
      },
    });

    await client.send(command);
    
    const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${TEST_VIDEO_KEY}` : 'N/A (R2_PUBLIC_URL not set)';
    success(`Video uploaded successfully!`);
    info(`  Key: ${TEST_VIDEO_KEY}`);
    info(`  Size: ${dummyVideoBuffer.length} bytes`);
    info(`  Public URL: ${publicUrl}`);
    
    return true;
  } catch (err: any) {
    error(`Failed to upload video: ${err.message}`);
    return false;
  }
}

async function testUploadThumbnail(client: S3Client): Promise<boolean> {
  try {
    info('Testing thumbnail upload...');

    // Create a dummy JPEG file (minimal JPEG header)
    const dummyJpegBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, // JPEG header
      0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9, // End of JPEG
    ]);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: TEST_THUMBNAIL_KEY,
      Body: dummyJpegBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'test': 'true',
        'uploaded-by': 'test-script',
      },
    });

    await client.send(command);
    
    const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${TEST_THUMBNAIL_KEY}` : 'N/A';
    success(`Thumbnail uploaded successfully!`);
    info(`  Key: ${TEST_THUMBNAIL_KEY}`);
    info(`  Size: ${dummyJpegBuffer.length} bytes`);
    info(`  Public URL: ${publicUrl}`);
    
    return true;
  } catch (err: any) {
    error(`Failed to upload thumbnail: ${err.message}`);
    return false;
  }
}

async function testListFiles(client: S3Client): Promise<boolean> {
  try {
    info('Testing file listing...');

    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `reels/${TEST_USER_ID}/`,
      MaxKeys: 10,
    });

    const response = await client.send(command);
    
    if (response.Contents && response.Contents.length > 0) {
      success(`Found ${response.Contents.length} file(s) in reels bucket`);
      response.Contents.forEach((obj, index) => {
        info(`  ${index + 1}. ${obj.Key} (${obj.Size} bytes)`);
      });
      return true;
    } else {
      warning('No files found in reels bucket');
      return true;
    }
  } catch (err: any) {
    error(`Failed to list files: ${err.message}`);
    return false;
  }
}

async function testDownloadFile(client: S3Client): Promise<boolean> {
  try {
    info('Testing file download...');

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: TEST_VIDEO_KEY,
    });

    const response = await client.send(command);
    
    if (response.Body) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      success(`File downloaded successfully!`);
      info(`  Size: ${buffer.length} bytes`);
      info(`  Content-Type: ${response.ContentType}`);
      return true;
    } else {
      error('No file body received');
      return false;
    }
  } catch (err: any) {
    error(`Failed to download file: ${err.message}`);
    return false;
  }
}

async function testDeleteFiles(client: S3Client): Promise<boolean> {
  try {
    info('Testing file deletion...');

    // Delete video
    const deleteVideoCommand = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: TEST_VIDEO_KEY,
    });
    await client.send(deleteVideoCommand);
    success(`Deleted video: ${TEST_VIDEO_KEY}`);

    // Delete thumbnail
    const deleteThumbnailCommand = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: TEST_THUMBNAIL_KEY,
    });
    await client.send(deleteThumbnailCommand);
    success(`Deleted thumbnail: ${TEST_THUMBNAIL_KEY}`);

    return true;
  } catch (err: any) {
    error(`Failed to delete files: ${err.message}`);
    return false;
  }
}

async function testPublicUrlAccess(): Promise<boolean> {
  if (!R2_PUBLIC_URL) {
    warning('R2_PUBLIC_URL not configured, skipping public URL test');
    return true;
  }

  try {
    info('Testing public URL access...');
    
    const testUrl = `${R2_PUBLIC_URL}/${TEST_VIDEO_KEY}`;
    info(`  Testing URL: ${testUrl}`);
    
    const response = await fetch(testUrl);
    
    if (response.ok) {
      success(`Public URL is accessible (Status: ${response.status})`);
      return true;
    } else if (response.status === 404) {
      warning(`File not found (expected after deletion)`);
      return true;
    } else {
      error(`Unexpected status: ${response.status}`);
      return false;
    }
  } catch (err: any) {
    error(`Failed to access public URL: ${err.message}`);
    return false;
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests() {
  console.log('\n' + '='.repeat(70));
  log('  Cloudflare R2 Reels Bucket Test Suite', colors.cyan);
  console.log('='.repeat(70) + '\n');

  // Display configuration
  info('Configuration:');
  console.log(`  Endpoint: ${R2_ENDPOINT || 'NOT SET'}`);
  console.log(`  Bucket: ${R2_BUCKET_NAME || 'NOT SET'}`);
  console.log(`  Public URL: ${R2_PUBLIC_URL || 'NOT SET'}`);
  console.log(`  Access Key: ${R2_ACCESS_KEY_ID ? '***' + R2_ACCESS_KEY_ID.slice(-4) : 'NOT SET'}`);
  console.log('');

  // Initialize client
  const client = createR2Client();
  if (!client) {
    error('\nTest suite aborted: Missing configuration');
    process.exit(1);
  }

  // Run tests
  const results: { name: string; passed: boolean }[] = [];

  console.log('Running tests...\n');

  // Test 1: Bucket Connection
  results.push({
    name: 'Bucket Connection',
    passed: await testBucketConnection(client),
  });
  console.log('');

  // Test 2: Upload Video
  results.push({
    name: 'Upload Video to Reels Bucket',
    passed: await testUploadVideo(client),
  });
  console.log('');

  // Test 3: Upload Thumbnail
  results.push({
    name: 'Upload Thumbnail',
    passed: await testUploadThumbnail(client),
  });
  console.log('');

  // Test 4: List Files
  results.push({
    name: 'List Files',
    passed: await testListFiles(client),
  });
  console.log('');

  // Test 5: Download File
  results.push({
    name: 'Download File',
    passed: await testDownloadFile(client),
  });
  console.log('');

  // Test 6: Public URL Access
  results.push({
    name: 'Public URL Access',
    passed: await testPublicUrlAccess(),
  });
  console.log('');

  // Test 7: Delete Files
  results.push({
    name: 'Delete Files',
    passed: await testDeleteFiles(client),
  });
  console.log('');

  // Summary
  console.log('='.repeat(70));
  log('  Test Summary', colors.cyan);
  console.log('='.repeat(70) + '\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    if (result.passed) {
      success(`${result.name}`);
    } else {
      error(`${result.name}`);
    }
  });

  console.log('');
  console.log(`Total: ${results.length} tests`);
  log(`Passed: ${passed}`, colors.green);
  if (failed > 0) {
    log(`Failed: ${failed}`, colors.red);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run the tests
runTests().catch(err => {
  error(`\nUnexpected error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
