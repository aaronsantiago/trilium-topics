
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

let lastT9DbCache = null;
let lastT9DbWordCount = -1;
function generateT9Db(allWords) {
  if (allWords.length == lastT9DbWordCount && lastT9DbCache) {
    return lastT9DbCache;
  }
  let t9Db = {};
  for (let word of allWords) {
    let curT9Db = t9Db;
    for (let [i, c] of word.split('').entries()) {
      c = mapping[c];
      if (!c) {
        break;
      }
      if (!(c in curT9Db)) {
        curT9Db[c] = {
          entries:new Set([]),
        };
      }
      if (i == word.length - 1) {
        curT9Db[c].entries.add(word);
      }
      curT9Db = curT9Db[c];
    }
  }

  lastT9DbCache = t9Db;
  lastT9DbWordCount = allWords.length;
  return t9Db;
}

export { generateT9Db };
