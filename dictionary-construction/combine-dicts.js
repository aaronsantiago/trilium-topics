import { readFileSync, writeFileSync } from 'fs';

const files = [
  'ngram_words_2_dictionary.txt',
  'google-10000-english-usa.txt',
  'ngram_words_3_dictionary.txt',
  'ngram_words_4_dictionary.txt',
  'ngram_words_5_dictionary.txt',
];

const seen = new Set();
const combined = [];

for (const file of files) {
  const words = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  let added = 0;
  for (const word of words) {
    if (!seen.has(word)) {
      seen.add(word);
      combined.push(word);
      added++;
    }
  }
  console.log(`${file}: +${added} new words`);
}

writeFileSync('master-dictionary.txt', combined.join('\n') + '\n');
console.log(`\ntotal: ${combined.length} words`);
