import fetch from 'node-fetch';
import { getScriptApiBase } from './urls';

const SERVER_URL = getScriptApiBase();
const DEMO_EMAIL = 'aibuilder80@gmail.com';

async function testClerkEndpoints() {
  console.log('🔍 Testing Clerk Endpoints on Railway Server');
  console.log('=' .repeat(60));
  console.log(`Server: ${SERVER_URL}`);
  console.log('=' .repeat(60));

  try {
    // Test 1: Check available endpoints
    console.log('\n1. Testing available endpoints...');
    
    const endpoints = [
      '/api/health',
      '/api/clerk/me',
      '/api/clerk/search',
      '/api/users',
      '/api/auth',
      '/health'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${SERVER_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log(`   ${endpoint}: ${response.status} ${response.statusText}`);
        
        if (response.status === 200) {
          try {
            const data = await response.json();
            console.log(`     Response: ${JSON.stringify(data).substring(0, 100)}...`);
          } catch (e) {
            console.log('     Response: (not JSON)');
          }
        } else if (response.status === 401) {
          console.log('     ✅ Requires authentication (expected)');
        }
      } catch (error) {
        console.log(`   ${endpoint}: ❌ Error - ${error.message}`);
      }
    }

    // Test 2: Check if we can search for the demo user
    console.log('\n2. Testing user search without auth...');
    try {
      const searchResponse = await fetch(`${SERVER_URL}/api/clerk/search?q=aibuilder80`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`   Search Status: ${searchResponse.status}`);
      
      if (searchResponse.status === 401) {
        console.log('   ✅ Search requires authentication (expected)');
      } else {
        const searchData = await searchResponse.text();
        console.log(`   Search Response: ${searchData.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`   Search Error: ${error.message}`);
    }

    // Test 3: Check webhook endpoints (might give us info about user creation)
    console.log('\n3. Testing webhook endpoints...');
    const webhookEndpoints = [
      '/api/webhook/clerk',
      '/api/webhooks/clerk',
      '/webhook/clerk'
    ];

    for (const endpoint of webhookEndpoints) {
      try {
        const response = await fetch(`${SERVER_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ test: true })
        });

        console.log(`   ${endpoint}: ${response.status} ${response.statusText}`);
      } catch (error) {
        console.log(`   ${endpoint}: ❌ ${error.message}`);
      }
    }

    // Test 4: Try to get server info
    console.log('\n4. Testing server info endpoints...');
    const infoEndpoints = [
      '/api/version',
      '/api/status',
      '/api/info',
      '/version',
      '/status'
    ];

    for (const endpoint of infoEndpoints) {
      try {
        const response = await fetch(`${SERVER_URL}${endpoint}`, {
          method: 'GET'
        });

        console.log(`   ${endpoint}: ${response.status}`);
        
        if (response.ok) {
          const data = await response.text();
          console.log(`     Data: ${data.substring(0, 100)}...`);
        }
      } catch (error) {
        console.log(`   ${endpoint}: ❌ ${error.message}`);
      }
    }

    // Test 5: Check database health (might tell us about users)
    console.log('\n5. Testing database endpoints...');
    try {
      const dbResponse = await fetch(`${SERVER_URL}/api/health/db`, {
        method: 'GET'
      });

      console.log(`   DB Health: ${dbResponse.status}`);
      
      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        console.log(`   DB Status: ${dbData.status}`);
        if (dbData.stats) {
          console.log(`   DB Stats: ${JSON.stringify(dbData.stats)}`);
        }
      }
    } catch (error) {
      console.log(`   DB Health Error: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }

  console.log('\n🔚 Endpoint tests completed');
}

testClerkEndpoints().catch(console.error);