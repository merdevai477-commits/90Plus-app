
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.join(__dirname, '../.env') });

import { logger } from '../src/utils/logger';

async function main() {
  const apiKey = process.env.FOOTBALL_API_KEY;
  
  console.log('----------------------------------------');
  console.log('🔍 Checking Football API Connection');
  console.log('----------------------------------------');

  if (!apiKey) {
    logger.error('❌ FOOTBALL_API_KEY is missing in .env');
    process.exit(1);
  }

  logger.info(`🔑 API Key found: ${apiKey.substring(0, 5)}...`);

  const baseUrl = 'https://v3.football.api-sports.io';
  const endpoint = '/status';

  try {
    logger.info(`📡 Sending request to ${baseUrl}${endpoint}...`);
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        'x-apisports-key': apiKey,
        'Accept': 'application/json',
      },
    });

    logger.info(`📥 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      logger.error('❌ API Request Failed!');
      const text = await response.text();
      console.error('Response Body:', text);
      process.exit(1);
    }

    const data = await response.json();
    
    if (data.errors && Object.keys(data.errors).length > 0) {
      logger.error('❌ API Returned Errors:', data.errors);
      process.exit(1);
    }

    logger.info('✅ API Connection Successful!');
    logger.info('📊 Account Status:', data.response.account);
    logger.info('----------------------------------------');
    
    // Check subscription details
    const account = data.response.account;
    const requests = data.response.requests;
    
    console.log(`👤 Name: ${account.firstname} ${account.lastname}`);
    console.log(`📧 Email: ${account.email}`);
    console.log(`📦 Plan: ${account.plan}`);
    console.log(`📈 Requests Today: ${requests.current} / ${requests.limit_day}`);
    
    if (requests.current >= requests.limit_day) {
      logger.warn('⚠️ DAILY LIMIT REACHED! This will cause 500 errors.');
    }

  } catch (error) {
    logger.error('❌ Network Error:', error);
    process.exit(1);
  }
}

main();
