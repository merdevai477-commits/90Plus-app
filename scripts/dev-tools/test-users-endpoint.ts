import fetch from 'node-fetch';
import { getScriptApiBase } from './urls';

const SERVER_URL = getScriptApiBase();
const DEMO_EMAIL = 'aibuilder80@gmail.com';

async function testUsersEndpoint() {
  console.log('🔍 Testing Users Endpoint for Demo Account');
  console.log('=' .repeat(60));
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Looking for: ${DEMO_EMAIL}`);
  console.log('=' .repeat(60));

  try {
    // Test the /api/users endpoint
    console.log('\n1. Fetching all users from /api/users...');
    
    const response = await fetch(`${SERVER_URL}/api/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   Total Users: ${data.count}`);
      console.log(`   Users Found: ${data.users?.length || 0}`);
      
      if (data.users && Array.isArray(data.users)) {
        console.log('\n2. Checking each user...');
        
        let demoAccountFound = false;
        
        data.users.forEach((user: any, index: number) => {
          console.log(`\n   User ${index + 1}:`);
          console.log(`     ID: ${user.id}`);
          console.log(`     Email: ${user.email}`);
          console.log(`     Username: ${user.username || 'Not set'}`);
          console.log(`     Display Name: ${user.displayName || 'Not set'}`);
          console.log(`     Clerk ID: ${user.clerkUserId || 'Not set'}`);
          console.log(`     Is Developer: ${user.isDeveloper || false}`);
          console.log(`     Is Verified: ${user.isVerified || false}`);
          console.log(`     Status: ${user.isSuspended ? 'SUSPENDED' : user.isBanned ? 'BANNED' : user.isDeleted ? 'DELETED' : 'ACTIVE'}`);
          console.log(`     Coins: ${user.coins || 0}`);
          console.log(`     Level: ${user.level || 1}`);
          console.log(`     Created: ${user.createdAt}`);
          
          // Check if this is the demo account
          if (user.email === DEMO_EMAIL) {
            demoAccountFound = true;
            console.log('     🎉 THIS IS THE DEMO ACCOUNT!');
          }
        });
        
        console.log('\n3. Demo Account Status:');
        if (demoAccountFound) {
          console.log('   ✅ DEMO ACCOUNT FOUND IN DATABASE!');
          console.log('   The account aibuilder80@gmail.com exists on the server.');
        } else {
          console.log('   ❌ DEMO ACCOUNT NOT FOUND!');
          console.log('   The account aibuilder80@gmail.com does not exist in the database.');
          console.log('   This means the account needs to be created.');
        }
        
        // Check for similar emails
        console.log('\n4. Checking for similar email patterns...');
        const similarEmails = data.users.filter((user: any) => 
          user.email && (
            user.email.toLowerCase().includes('aibuilder') ||
            user.email.toLowerCase().includes('demo') ||
            user.email.toLowerCase().includes('test') ||
            user.email.toLowerCase().includes('apple')
          )
        );
        
        if (similarEmails.length > 0) {
          console.log('   Found similar emails:');
          similarEmails.forEach((user: any) => {
            console.log(`     - ${user.email} (${user.username})`);
          });
        } else {
          console.log('   No similar demo/test emails found.');
        }
        
      } else {
        console.log('   ❌ No users array in response');
      }
      
    } else {
      console.log('   ❌ Failed to fetch users');
      const errorText = await response.text();
      console.log(`   Error: ${errorText}`);
    }

    // Test with pagination to see if there are more users
    console.log('\n5. Testing pagination...');
    try {
      const paginatedResponse = await fetch(`${SERVER_URL}/api/users?page=1&limit=50`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (paginatedResponse.ok) {
        const paginatedData = await paginatedResponse.json();
        console.log(`   Paginated Total: ${paginatedData.count}`);
        console.log(`   Paginated Users: ${paginatedData.users?.length || 0}`);
      }
    } catch (e) {
      console.log('   Pagination not supported or error occurred');
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }

  console.log('\n🔚 Users endpoint test completed');
}

testUsersEndpoint().catch(console.error);