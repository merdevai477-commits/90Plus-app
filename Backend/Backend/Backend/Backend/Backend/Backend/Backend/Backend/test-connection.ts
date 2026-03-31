import net from 'net';

const HOST = 'ep-lively-bird-adffhlg9-pooler.c-2.us-east-1.aws.neon.tech';
const PORT = 5432;

console.log(`\n🔍 Testing TCP connection to ${HOST}:${PORT}...`);

const client = new net.Socket();
client.setTimeout(10000); // 10 seconds timeout

client.connect(PORT, HOST, () => {
    console.log('✅ TCP Connection Successful!');
    console.log('   This means your computer CAN reach the Supabase server.');
    console.log('   The issue might be with SSL/TLS or authentication.');
    client.destroy();
});

client.on('error', (err) => {
    console.error('❌ TCP Connection Failed:', err.message);
    console.log('\nPossible causes:');
    console.log('1. Supabase Project is PAUSED (Check Dashboard)');
    console.log('2. Firewall/Antivirus is blocking port 5432');
    console.log('3. No Internet connection or DNS issues');
});

client.on('timeout', () => {
    console.error('❌ Connection Timed Out');
    console.log('   Server did not respond in 10 seconds.');
    client.destroy();
});
