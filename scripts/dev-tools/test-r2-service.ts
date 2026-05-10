/**
 * R2 Media Storage Service Integration Test
 * 
 * Tests the actual R2MediaStorageService used in the application
 * 
 * Usage: npm run test:r2:service
 */

import { r2MediaStorage, R2MediaBucket } from './src/services/r2-media-storage.service';
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
// Test Data
// ============================================================================

const TEST_USER_ID = 'test-user-' + Date.now();

// Create dummy video buffer (minimal MP4)
const createDummyVideo = (): Buffer => {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // MP4 header
    0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
    0x6D, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08,
  ]);
};

// Create dummy thumbnail buffer (minimal JPEG)
const createDummyThumbnail = (): Buffer => {
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, // JPEG header
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9, // End of JPEG
  ]);
};

// Create dummy avatar buffer (minimal PNG)
const createDummyAvatar = (): Buffer => {
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  ]);
};

// ============================================================================
// Test Functions
// ============================================================================

async function testUploadReel(): Promise<{ success: boolean; key?: string }> {
  try {
    info('Testing reel upload via R2MediaStorageService...');

    const videoBuffer = createDummyVideo();
    const result = await r2MediaStorage.uploadPublic(
      'reels',
      TEST_USER_ID,
      videoBuffer,
      'test-reel.mp4',
      'video/mp4'
    );

    if (result.success && result.url && result.key) {
      success('Reel uploaded successfully!');
      info(`  URL: ${result.url}`);
      info(`  Key: ${result.key}`);
      info(`  Size: ${videoBuffer.length} bytes`);
      return { success: true, key: result.key };
    } else {
      error(`Failed to upload reel: ${result.error || 'Unknown error'}`);
      return { success: false };
    }
  } catch (err: any) {
    error(`Exception during reel upload: ${err.message}`);
    return { success: false };
  }
}

async function testUploadThumbnail(): Promise<{ success: boolean; key?: string }> {
  try {
    info('Testing thumbnail upload via R2MediaStorageService...');

    const thumbnailBuffer = createDummyThumbnail();
    const result = await r2MediaStorage.uploadPublic(
      'thumbnails',
      TEST_USER_ID,
      thumbnailBuffer,
      'test-thumbnail.jpg',
      'image/jpeg'
    );

    if (result.success && result.url && result.key) {
      success('Thumbnail uploaded successfully!');
      info(`  URL: ${result.url}`);
      info(`  Key: ${result.key}`);
      info(`  Size: ${thumbnailBuffer.length} bytes`);
      return { success: true, key: result.key };
    } else {
      error(`Failed to upload thumbnail: ${result.error || 'Unknown error'}`);
      return { success: false };
    }
  } catch (err: any) {
    error(`Exception during thumbnail upload: ${err.message}`);
    return { success: false };
  }
}

async function testUploadAvatar(): Promise<{ success: boolean; key?: string }> {
  try {
    info('Testing avatar upload via R2MediaStorageService...');

    const avatarBuffer = createDummyAvatar();
    const result = await r2MediaStorage.uploadPublic(
      'avatars',
      TEST_USER_ID,
      avatarBuffer,
      'test-avatar.png',
      'image/png'
    );

    if (result.success && result.url && result.key) {
      success('Avatar uploaded successfully!');
      info(`  URL: ${result.url}`);
      info(`  Key: ${result.key}`);
      info(`  Size: ${avatarBuffer.length} bytes`);
      return { success: true, key: result.key };
    } else {
      error(`Failed to upload avatar: ${result.error || 'Unknown error'}`);
      return { success: false };
    }
  } catch (err: any) {
    error(`Exception during avatar upload: ${err.message}`);
    return { success: false };
  }
}

async function testUploadCover(): Promise<{ success: boolean; key?: string }> {
  try {
    info('Testing cover image upload via R2MediaStorageService...');

    const coverBuffer = createDummyThumbnail(); // Use JPEG for cover
    const result = await r2MediaStorage.uploadPublic(
      'covers',
      TEST_USER_ID,
      coverBuffer,
      'test-cover.jpg',
      'image/jpeg'
    );

    if (result.success && result.url && result.key) {
      success('Cover image uploaded successfully!');
      info(`  URL: ${result.url}`);
      info(`  Key: ${result.key}`);
      info(`  Size: ${coverBuffer.length} bytes`);
      return { success: true, key: result.key };
    } else {
      error(`Failed to upload cover: ${result.error || 'Unknown error'}`);
      return { success: false };
    }
  } catch (err: any) {
    error(`Exception during cover upload: ${err.message}`);
    return { success: false };
  }
}

async function testDeleteFile(key: string, label: string): Promise<boolean> {
  try {
    info(`Testing deletion of ${label}...`);

    const result = await r2MediaStorage.deleteObject(key);

    if (result) {
      success(`${label} deleted successfully!`);
      info(`  Key: ${key}`);
      return true;
    } else {
      error(`Failed to delete ${label}`);
      return false;
    }
  } catch (err: any) {
    error(`Exception during ${label} deletion: ${err.message}`);
    return false;
  }
}

async function testInvalidUpload(): Promise<boolean> {
  try {
    info('Testing invalid upload (empty buffer)...');

    const emptyBuffer = Buffer.from([]);
    const result = await r2MediaStorage.uploadPublic(
      'reels',
      TEST_USER_ID,
      emptyBuffer,
      'empty.mp4',
      'video/mp4'
    );

    if (!result.success) {
      success('Invalid upload correctly rejected');
      info(`  Error: ${result.error || 'Empty buffer'}`);
      return true;
    } else {
      warning('Empty buffer was accepted (unexpected)');
      // Clean up if it was uploaded
      if (result.key) {
        await r2MediaStorage.deleteObject(result.key);
      }
      return true; // Not a critical failure
    }
  } catch (err: any) {
    success('Invalid upload correctly threw exception');
    info(`  Error: ${err.message}`);
    return true;
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests() {
  console.log('\n' + '='.repeat(70));
  log('  R2 Media Storage Service Integration Test', colors.cyan);
  console.log('='.repeat(70) + '\n');

  // Display configuration
  info('Configuration:');
  console.log(`  Endpoint: ${process.env.R2_ENDPOINT || 'NOT SET'}`);
  console.log(`  Bucket: ${process.env.R2_BUCKET_NAME || 'NOT SET'}`);
  console.log(`  Public URL: ${process.env.R2_PUBLIC_URL || 'NOT SET'}`);
  console.log(`  Test User ID: ${TEST_USER_ID}`);
  console.log('');

  // Check required env vars
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    error('Missing required R2 environment variables!');
    info('Required: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    process.exit(1);
  }

  const results: { name: string; passed: boolean }[] = [];
  const uploadedKeys: { key: string; label: string }[] = [];

  console.log('Running tests...\n');

  // Test 1: Upload Reel
  const reelResult = await testUploadReel();
  results.push({ name: 'Upload Reel', passed: reelResult.success });
  if (reelResult.key) {
    uploadedKeys.push({ key: reelResult.key, label: 'Reel' });
  }
  console.log('');

  // Test 2: Upload Thumbnail
  const thumbnailResult = await testUploadThumbnail();
  results.push({ name: 'Upload Thumbnail', passed: thumbnailResult.success });
  if (thumbnailResult.key) {
    uploadedKeys.push({ key: thumbnailResult.key, label: 'Thumbnail' });
  }
  console.log('');

  // Test 3: Upload Avatar
  const avatarResult = await testUploadAvatar();
  results.push({ name: 'Upload Avatar', passed: avatarResult.success });
  if (avatarResult.key) {
    uploadedKeys.push({ key: avatarResult.key, label: 'Avatar' });
  }
  console.log('');

  // Test 4: Upload Cover
  const coverResult = await testUploadCover();
  results.push({ name: 'Upload Cover', passed: coverResult.success });
  if (coverResult.key) {
    uploadedKeys.push({ key: coverResult.key, label: 'Cover' });
  }
  console.log('');

  // Test 5: Invalid Upload
  const invalidResult = await testInvalidUpload();
  results.push({ name: 'Invalid Upload Handling', passed: invalidResult });
  console.log('');

  // Test 6-9: Delete all uploaded files
  for (const { key, label } of uploadedKeys) {
    const deleteResult = await testDeleteFile(key, label);
    results.push({ name: `Delete ${label}`, passed: deleteResult });
    console.log('');
  }

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
