// Extracts the embedded Postman v2.1 collection from .postman.json into a
// standalone file Newman can run.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(root, '.postman.json'), 'utf8'));

if (!src.collection) {
    console.error('No `collection` key found in .postman.json');
    process.exit(1);
}

const out = path.join(__dirname, 'collection.json');
fs.writeFileSync(out, JSON.stringify(src.collection, null, 2));
console.log(`Wrote ${out}`);
console.log(`Collection name: ${src.collection.info?.name}`);
console.log(`Top-level folders: ${(src.collection.item || []).length}`);
