import { readFileSync } from 'fs';

const ngram = new Set(readFileSync('ngram_words_2_dictionary.txt', 'utf8').split('\n').filter(Boolean));
const google = readFileSync('google-10000-english-usa.txt', 'utf8').split('\n').filter(Boolean);

const newWords = google.filter(w => !ngram.has(w));

console.log(`ngram dictionary:  ${ngram.size} words`);
console.log(`google-10000:      ${google.length} words`);
console.log(`new words added:   ${newWords.length}`);
