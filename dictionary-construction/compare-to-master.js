import { readFileSync } from 'fs';

const master = new Set(readFileSync('ngram2-google-dictionary.txt', 'utf8').split('\n').filter(Boolean));
console.log(`Master dictionary: ${master.size} words\n`);

for (const file of ['ngram_words_3_dictionary.txt', 'ngram_words_4_dictionary.txt', 'ngram_words_5_dictionary.txt']) {
  const words = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const newWords = words.filter(w => !master.has(w));
  console.log(`${file}: ${newWords.length} new words out of ${words.length}`);
  for (const w of newWords) console.log(`  ${w}`);
}
