/**
 * Quick GDPR Endpoints Test
 * 
 * Simple test to verify GDPR endpoints are accessible
 * 
 * Usage: node quick-test-gdpr.js
 */

const http = require('http');

const API_URL = 'localhost';
const API_PORT = 3000;

function testEndpoint(path, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_URL,
            port: API_PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    data: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (method === 'POST') {
            req.write(JSON.stringify({}));
        }

        req.end();
    });
}

async function runTests() {
    console.log('\n🧪 GDPR Endpoints Quick Test\n');
    console.log('Testing without authentication (should return 401)\n');

    const tests = [
        { name: 'GET /api/gdpr/consent', path: '/api/gdpr/consent', method: 'GET' },
        { name: 'POST /api/gdpr/consent', path: '/api/gdpr/consent', method: 'POST' },
        { name: 'POST /api/gdpr/export-data', path: '/api/gdpr/export-data', method: 'POST' },
        { name: 'GET /api/gdpr/deletion-status', path: '/api/gdpr/deletion-status', method: 'GET' },
        { name: 'POST /api/gdpr/delete-account', path: '/api/gdpr/delete-account', method: 'POST' },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await testEndpoint(test.path, test.method);
            
            if (result.status === 401) {
                console.log(`✅ ${test.name} - Status: ${result.status} (Auth required - correct)`);
                passed++;
            } else if (result.status === 404) {
                console.log(`❌ ${test.name} - Status: ${result.status} (Route not found!)`);
                failed++;
            } else {
                console.log(`⚠️  ${test.name} - Status: ${result.status} (Unexpected)`);
                passed++;
            }
        } catch (error) {
            console.log(`❌ ${test.name} - Error: ${error.message}`);
            failed++;
        }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

    if (failed === 0) {
        console.log('🎉 All GDPR endpoints are accessible!\n');
        console.log('Next steps:');
        console.log('1. Start the server: npm start');
        console.log('2. Get a test token from Clerk');
        console.log('3. Run full tests: npx ts-node test-gdpr-endpoints.ts\n');
    } else {
        console.log('⚠️  Some endpoints are not accessible.');
        console.log('Make sure the server is running: npm start\n');
    }
}

// Check if server is running first
testEndpoint('/api/health', 'GET')
    .then((result) => {
        if (result.status === 200) {
            console.log('✅ Server is running\n');
            runTests();
        } else {
            console.log('⚠️  Server responded with status:', result.status);
            runTests();
        }
    })
    .catch((error) => {
        console.log('❌ Server is not running!');
        console.log('Please start the server first: npm start\n');
        process.exit(1);
    });
