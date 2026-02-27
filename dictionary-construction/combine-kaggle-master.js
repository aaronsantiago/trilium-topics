import { readFileSync, writeFileSync } from "fs";

const kaggle = readFileSync("kaggle.txt", "utf8").split("\n").filter(Boolean);
const master = readFileSync("master-dictionary-lowercase.txt", "utf8").split("\n").filter(Boolean);

const seen = new Set(kaggle);
const masterOnly = master.filter(w => !seen.has(w));

const combined = [...kaggle, ...masterOnly];
writeFileSync("master-dictionary-lowercase.txt", combined.join("\n") + "\n");

console.log(`kaggle: ${kaggle.length}, master additions: ${masterOnly.length}, total: ${combined.length}`);
