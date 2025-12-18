
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'pages', 'api', 'send-email.js');
const code = fs.readFileSync(filePath, 'utf8');

function checkBalance(text) {
    const stack = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '{') stack.push({ char, line: i + 1, col: j + 1 });
            if (char === '}') {
                if (stack.length === 0) {
                    console.error(`❌ Unexpected '}' at line ${i + 1}:${j + 1}`);
                    return;
                }
                stack.pop();
            }
        }
    }

    if (stack.length > 0) {
        const last = stack[stack.length - 1];
        console.error(`❌ Unclosed '{' at line ${last.line}:${last.col}`);
    } else {
        console.log("✅ Braces are balanced.");
    }
}

console.log(`Checking syntax for: ${filePath}`);
checkBalance(code);
