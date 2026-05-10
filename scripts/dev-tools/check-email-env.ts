import dotenv from 'dotenv';
import path from 'path';

// Load .env from the current directory
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Checking Email Configuration...');
console.log('SMTP_HOST:', process.env.SMTP_HOST || 'Not set (defaulting to smtp.gmail.com)');
console.log('SMTP_PORT:', process.env.SMTP_PORT || 'Not set (defaulting to 587)');
console.log('SMTP_USER:', process.env.SMTP_USER ? 'Set (Length: ' + process.env.SMTP_USER.length + ')' : 'NOT SET');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'Set (Length: ' + process.env.SMTP_PASS.length + ')' : 'NOT SET');

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('\n❌ ERROR: SMTP_USER or SMTP_PASS is missing in .env file.');
    console.error('Please add them to your .env file in the Backend directory.');
} else {
    console.log('\n✅ Configuration present. If authentication fails, check if the password is an App Password.');
}
