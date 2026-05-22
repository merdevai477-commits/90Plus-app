/**
 * Normalize ios/.xcode.env* to Unix (LF) line endings.
 * Windows-created or checked-out CRLF files break Xcode shell phases on EAS/macOS.
 */
import fs from 'fs';
import path from 'path';

const iosDir = path.join(process.cwd(), 'ios');
const files = ['.xcode.env', '.xcode.env.local', '.xcode.env.updates'];

if (!fs.existsSync(iosDir)) {
  console.log('fix-xcode-env: no ios/ directory, skipping');
  process.exit(0);
}

for (const name of files) {
  const filePath = path.join(iosDir, name);
  if (!fs.existsSync(filePath)) continue;

  const original = fs.readFileSync(filePath, 'utf8');
  const fixed = original.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (fixed !== original) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`fix-xcode-env: normalized line endings in ios/${name}`);
  }
}
