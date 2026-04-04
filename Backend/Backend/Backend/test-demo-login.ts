import fetch from 'node-fetch';

const SERVER_URL = 'https://90plus-app-production.up.railway.app';
const DEMO_EMAIL = 'aibuilder80@gmail.com';
const DEMO_PASSWORD = '1872004ME';

async function testDemoLogin() {
  console.log('🔍 Testing Demo Account Login on Railway Server');
  console.log('=' .repeat(60));
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log('=' .repeat(60));

  try {
    // Test 1: Check server health
    console.log('\n1. Testing server health...');
    const healthResponse = await fetch(`${SERVER_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Server is healthy');
      console.log(`   Status: ${healthData.status}`);
      console.log(`   Timestamp: ${healthData.timestamp}`);
    } else {
      console.log('❌ Server health check failed');
      console.log(`   Status: ${healthResponse.status}`);
      console.log(`   Status Text: ${healthResponse.statusText}`);
    }

    // Test 2: Check database health
    console.log('\n2. Testing database connection...');
    const dbHealthResponse = await fetch(`${SERVER_URL}/api/health/db`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (dbHealthResponse.ok) {
      const dbHealthData = await dbHealthResponse.json();
      console.log('✅ Database is connected');
      console.log(`   Status: ${dbHealthData.status}`);
    } else {
      console.log('❌ Database health check failed');
      console.log(`   Status: ${dbHealthResponse.status}`);
    }

    // Test 3: Try to login with demo account
    console.log('\n3. Testing demo account login...');
    const loginResponse = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD
      })
    });

    console.log(`   Response Status: ${loginResponse.status}`);
    console.log(`   Response Status Text: ${loginResponse.statusText}`);

    const loginData = await loginResponse.text();
    
    if (loginResponse.ok) {
      console.log('✅ Demo account login SUCCESSFUL!');
      try {
        const parsedData = JSON.parse(loginData);
        console.log('   Response data:');
        console.log(`   - User ID: ${parsedData.user?.id || 'N/A'}`);
        console.log(`   - Username: ${parsedData.user?.username || 'N/A'}`);
        console.log(`   - Email: ${parsedData.user?.email || 'N/A'}`);
        console.log(`   - Token: ${parsedData.token ? 'Present' : 'Missing'}`);
      } catch (e) {
        console.log('   Raw response:', loginData);
      }
    } else {
      console.log('❌ Demo account login FAILED!');
      console.log('   Response:', loginData);
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(loginData);
        console.log(`   Error: ${errorData.error || errorData.message || 'Unknown error'}`);
      } catch (e) {
        console.log('   Raw error response:', loginData);
      }
    }

    // Test 4: Check if user exists in database (alternative endpoint)
    console.log('\n4. Checking if user exists via alternative method...');
    const userCheckResponse = await fetch(`${SERVER_URL}/api/users/check-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: DEMO_EMAIL
      })
    });

    if (userCheckResponse.ok) {
      const userData = await userCheckResponse.json();
      console.log('✅ User check endpoint responded');
      console.log(`   User exists: ${userData.exists ? 'YES' : 'NO'}`);
    } else {
      console.log('❌ User check endpoint failed or not available');
      console.log(`   Status: ${userCheckResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Network error or server unreachable:', error.message);
    console.log('\nPossible causes:');
    console.log('1. Server is down or not deployed');
    console.log('2. Network connectivity issues');
    console.log('3. Railway service is paused');
    console.log('4. Incorrect server URL');
  }

  console.log('\n🔚 Test completed');
}

// Run the test
testDemoLogin().catch(console.error);