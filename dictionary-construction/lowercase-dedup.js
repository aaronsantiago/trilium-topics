import { readFileSync, writeFileSync } from 'fs';

const words = readFileSync('master-dictionary.txt', 'utf8').split('\n').filter(Boolean);

const seen = new Set();
const result = [];

for (const word of words) {
  const lower = word.toLowerCase();
  if (!seen.has(lower)) {
    seen.add(lower);
    result.push(lower);
  }
}

writeFileSync('master-dictionary-lowercase.txt', result.join('\n') + '\n');
console.log(`input:  ${words.length} words`);
console.log(`output: ${result.length} words`);
console.log(`removed: ${words.length - result.length} duplicates`);
