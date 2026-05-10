import fetch from 'node-fetch';

const POSSIBLE_URLS = [
  'https://90plus-app-production.up.railway.app',
  'https://90plus-app-production-26e9.up.railway.app',
  'https://backend-production-26e9.up.railway.app',
  'https://football-app-backend.up.railway.app',
  'https://90plus-backend.up.railway.app'
];

const DEMO_EMAIL = 'aibuilder80@gmail.com';
const DEMO_PASSWORD = '1872004ME';

async function testMultipleUrls() {
  console.log('🔍 Testing Multiple Railway URLs');
  console.log('=' .repeat(50));

  for (const url of POSSIBLE_URLS) {
    console.log(`\n🌐 Testing: ${url}`);
    console.log('-'.repeat(40));

    try {
      // Test basic connectivity
      const response = await fetch(url, {
        method: 'GET',
        timeout: 10000
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);

      if (response.status === 200) {
        console.log('✅ Server is responding!');
        
        // Try health endpoint
        try {
          const healthResponse = await fetch(`${url}/health`);
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log(`   Health: ${healthData.status}`);
          }
        } catch (e) {
          console.log('   Health endpoint not available');
        }

        // Try API health
        try {
          const apiHealthResponse = await fetch(`${url}/api/health`);
          if (apiHealthResponse.ok) {
            const apiHealthData = await apiHealthResponse.json();
            console.log(`   API Health: ${apiHealthData.status}`);
          }
        } catch (e) {
          console.log('   API health endpoint not available');
        }

        // Try login endpoint
        try {
          const loginResponse = await fetch(`${url}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: DEMO_EMAIL,
              password: DEMO_PASSWORD
            })
          });

          console.log(`   Login Status: ${loginResponse.status}`);
          
          if (loginResponse.ok) {
            console.log('🎉 DEMO ACCOUNT LOGIN SUCCESSFUL!');
            const loginData = await loginResponse.json();
            console.log(`   User: ${loginData.user?.email}`);
            console.log(`   Token: ${loginData.token ? 'Present' : 'Missing'}`);
          } else {
            const errorText = await loginResponse.text();
            console.log(`   Login Error: ${errorText.substring(0, 100)}...`);
          }
        } catch (e) {
          console.log('   Login endpoint not available');
        }

      } else if (response.status === 404) {
        console.log('❌ Application not found');
      } else {
        console.log(`❌ Server error: ${response.status}`);
      }

    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
    }
  }

  console.log('\n🔚 All tests completed');
}

testMultipleUrls().catch(console.error);