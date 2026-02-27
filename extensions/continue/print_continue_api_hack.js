const fs = require('fs');
const content = fs.readFileSync('out/extension.js', 'utf-8');

// Find the activate function
const activateMatch = content.match(/function activate\([^)]*\)\s*\{/);
if (activateMatch) {
    const startIndex = activateMatch.index;
    const bodyStart = content.indexOf('{', startIndex);
    
    // Simple bracket matching to find the end of the activate function
    let depth = 1;
    let endIndex = -1;
    for (let i = bodyStart + 1; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') {
            depth--;
            if (depth === 0) {
                endIndex = i;
                break;
            }
        }
    }
    
    if (endIndex !== -1) {
        const activateBody = content.substring(bodyStart, endIndex + 1);
        const returnMatches = activateBody.match(/return\s+\{([^}]+)\}/g);
        console.log("Found returns:", returnMatches);
    }
}
