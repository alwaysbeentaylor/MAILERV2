
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'pages', 'api', 'send-email.js');
const code = fs.readFileSync(filePath, 'utf8');

function checkBalance(text) {
    const stack = [];
    const lines = text.split('\n');

    // Alleen lines 170-350 checken (analyzeWebsite) ongeveer
    // Maar better hele file.

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            if (['{', '(', '['].includes(char)) {
                stack.push({ char, line: i + 1, col: j + 1 });
            }

            if (['}', ')', ']'].includes(char)) {
                if (stack.length === 0) {
                    console.error(`❌ Unexpected '${char}' at line ${i + 1}:${j + 1}`);
                    return;
                }
                const last = stack.pop();
                const expected = last.char === '{' ? '}' : last.char === '(' ? ')' : ']';
                if (char !== expected) {
                    console.error(`❌ Mismatch: Found '${char}' at ${i + 1}:${j + 1} but expected '${expected}' for '${last.char}' from ${last.line}:${last.col}`);
                    return;
                }
            }
        }
    }

    if (stack.length > 0) {
        const last = stack[stack.length - 1];
        console.error(`❌ Unclosed '${last.char}' at line ${last.line}:${last.col}`);
    } else {
        console.log("✅ All brackets/braces/parens are balanced.");
    }
}

console.log(`Checking syntax for: ${filePath}`);
checkBalance(code);
