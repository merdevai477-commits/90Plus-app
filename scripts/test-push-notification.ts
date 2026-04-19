/**
 * Test Push Notification Script
 * Usage: npx tsx scripts/test-push-notification.ts <expo-push-token>
 */

import { PushNotificationService } from '../src/services/push-notification.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function testPushNotification(pushToken: string) {
  console.log('\n📱 Testing Push Notification...\n');
  console.log(`Token: ${pushToken.substring(0, 30)}...`);

  try {
    // Test 1: Regular notification
    console.log('\n1️⃣ Sending regular notification...');
    const result1 = await PushNotificationService.sendNotification({
      to: pushToken,
      title: '🎉 Test Notification',
      body: 'This is a test from 90Plus backend!',
      data: { test: true, timestamp: Date.now() },
    });
    console.log(result1 ? '✅ Success' : '❌ Failed');

    // Test 2: Silent notification
    console.log('\n2️⃣ Sending silent notification...');
    const result2 = await PushNotificationService.sendSilentNotification({
      pushToken,
      type: 'MATCH_UPDATE',
      data: { matchId: 'test-123' },
    });
    console.log(result2 ? '✅ Success' : '❌ Failed');

    // Test 3: Goal notification
    console.log('\n3️⃣ Sending goal notification...');
    const result3 = await PushNotificationService.sendGoalNotification(
      pushToken,
      'Real Madrid',
      'Barcelona',
      2,
      1,
      'home'
    );
    console.log(result3 ? '✅ Success' : '❌ Failed');

    console.log('\n✅ All tests completed!');
    console.log('📬 Check your device for notifications\n');
    
    // Wait for receipts to be checked (30 seconds)
    console.log('⏳ Waiting 35 seconds for receipt checking...');
    await new Promise(resolve => setTimeout(resolve, 35000));
    console.log('✅ Receipt check should be complete. Check logs for results.\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

const pushToken = process.argv[2];

if (!pushToken) {
  console.error('Usage: npx tsx scripts/test-push-notification.ts <expo-push-token>');
  console.error('\nExample:');
  console.error('npx tsx scripts/test-push-notification.ts ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
  process.exit(1);
}

testPushNotification(pushToken);
