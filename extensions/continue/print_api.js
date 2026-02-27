const fs = require('fs');
const content = fs.readFileSync('out/extension.js', 'utf-8');

// Find exports.activate
const idx = content.indexOf('exports.activate =');
console.log("Index of exports.activate:", idx);
if (idx > -1) {
    console.log(content.substring(idx, idx + 500));
}
