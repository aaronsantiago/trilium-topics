import { readFileSync, writeFileSync } from 'fs';

// Usage: node extract-words.js <input> <output> <numWords>
// numWords = number of word columns (2 for bigrams, 3 for trigrams, etc.)
const [input, output, numWords] = process.argv.slice(2);
const n = parseInt(numWords);

const text = readFileSync(input, 'utf8');
const seen = new Set();
const words = [];

for (const line of text.split('\n')) {
  const cols = line.trim().split('\t');
  for (let i = 1; i <= n; i++) {
    const word = cols[i];
    if (word && !seen.has(word)) {
      seen.add(word);
      words.push(word);
    }
  }
}

writeFileSync(output, words.join('\n') + '\n');
console.log(`${output}: ${words.length} words`);
