
let keyboardLayouts = {
  qwerty: ["qwertyuiop", "asdfghjkl;", "zxcvbnm,./"],
  colemak: ["qwfpgjluy;", "arstdhneio", "zxcvbkm,./"],
  dvorak: ["',.pyfgcrl", "aoeuidhtns", ";qjkxbmwvz"],
};
let t4 = {
  12: ["0", "10", "20","1", "11", "21","2", "12", "22"],
  13: ["3", "13", "23", "4", "14", "24"],
  16: ["6", "16", "26", "5", "15", "25"],
  17: ["7", "17", "27","8", "18", "28","9", "19", "29"]
}

function getKeyById(id) {
  let keyRow = Math.floor(id / 10);
  let keyCol = id % 10;
  return keyboardLayouts["colemak"][keyRow][keyCol];
}

let mapping = {};
for (let input in t4) {
  let inputKeyId = getKeyById("" + input);
  for (let i = 0; i < t4[input].length; i++) {
    mapping[getKeyById(t4[input][i])] = inputKeyId;
  }
}

function generateT9Db(inputFile) {
  let allWords = inputFile.split('\n');

  let wordPriority = {};
  for (let [i, word] of allWords.entries()) {
    allWords[i] = word.trim();
    wordPriority[word] = i;
  }

  let t9Db = {};
  for (let word of allWords) {
    let curT9Db = t9Db;
    for (let [i, c] of word.split('').entries()) {
      c = mapping[c.toLowerCase()];
      if (!c) {
        break;
      }
      if (!(c in curT9Db)) {
        curT9Db[c] = {
          entries:[],
        };
      }
      if (curT9Db[c].entries.indexOf(word) === -1 && (i == word.length - 1)) {
        curT9Db[c].entries.push(word);
      }
      curT9Db = curT9Db[c];
    }
  }

  return t9Db;
}

export { generateT9Db };
