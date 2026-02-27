import { createReadStream, createWriteStream } from "fs";
import { createInterface } from "readline";

const input = createReadStream("unigram_freq.csv");
const output = createWriteStream("kaggle.txt");

const rl = createInterface({ input, crlfDelay: Infinity });

let firstLine = true;
for await (const line of rl) {
  if (firstLine) { firstLine = false; continue; } // skip header
  const word = line.split(",")[0];
  if (word) output.write(word + "\n");
}

output.end();
console.log("Done → kaggle.txt");
