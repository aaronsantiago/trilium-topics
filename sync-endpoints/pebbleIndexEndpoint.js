const { req, res } = api;

function toTriliumDateString(epochMs) {
  const date = new Date(Number(epochMs));

  const pad = (n, len = 2) => String(n).padStart(len, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const millis = pad(date.getMilliseconds(), 3);

  // timezone offset: getTimezoneOffset() is minutes *behind* UTC (inverted sign)
  const offsetMin = -date.getTimezoneOffset();
  const offsetSign = offsetMin >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offsetMin) / 60));
  const offsetMinutes = pad(Math.abs(offsetMin) % 60);

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${millis}${offsetSign}${offsetHours}${offsetMinutes}`;
}

// shows NY time
function toHumanTime(epochMs) {
  const date = new Date(Number(epochMs));
  const year = date.getUTCFullYear();
  // US DST rule: starts 2nd Sunday in March, ends 1st Sunday in November, both at 2AM local
  function nthSunday(year, month, n) {
    // month is 0-indexed; find first Sunday, then add (n-1) weeks
    const d = new Date(Date.UTC(year, month, 1));
    const firstSunday = 1 + ((7 - d.getUTCDay()) % 7);
    return firstSunday + (n - 1) * 7;
  }
  const dstStart = Date.UTC(year, 2, nthSunday(year, 2, 2), 7); // 2nd Sun in March, 2AM EST = 7AM UTC
  const dstEnd = Date.UTC(year, 10, nthSunday(year, 10, 1), 6); // 1st Sun in Nov, 2AM EDT = 6AM UTC
  const ts = date.getTime();
  const isDST = ts >= dstStart && ts < dstEnd;
  const offsetHours = isDST ? 4 : 5; // EDT = UTC-4, EST = UTC-5
  const nyMillis = ts - (offsetHours * 60 * 60 * 1000);
  const nyDate = new Date(nyMillis);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const month = monthNames[nyDate.getUTCMonth()];
  const day = nyDate.getUTCDate();
  const nyYear = nyDate.getUTCFullYear();

  let hours = nyDate.getUTCHours();
  const minutes = String(nyDate.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${month} ${day} - ${hours}:${minutes}${ampm} - ${nyYear}`;
}

function parseMultipartFields(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
        if (!boundaryMatch) return reject(new Error('No multipart boundary found'));
        const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]);

        const fields = {};
        for (const rawPart of body.split(boundary)) {
          const part = rawPart.trim();
          if (!part || part === '--') continue;

          const nameMatch = part.match(/name="([^"]+)"/);
          if (!nameMatch) continue;

          const splitPoint = part.indexOf('\r\n\r\n');
          if (splitPoint === -1) continue;

          let value = part.slice(splitPoint + 4);
          value = value.replace(/\r\n--$/, '').trim();
          fields[nameMatch[1]] = value;
        }
        resolve(fields);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

if (req.method === "OPTIONS") {
  // NOTE: Trilium's global CORS middleware actually answers preflights itself
  // (204 with a fixed Content-Type,Authorization allow-list) before this
  // script runs — which is why the PWA cannot send a custom request header
  // and instead sends the secret as a multipart field (see below).
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, TRILIUM-SECRET');
  res.send(200);
} else if (req.method === "POST") {
    res.send(200);
    parseMultipartFields(req).then(fields => {
        // secret via TRILIUM-SECRET header (Pebble watch — no browser preflight)
        // or via multipart field (PWA — custom request headers fail Trilium's
        // global CORS preflight)
        const secret = req.get("TRILIUM-SECRET") || fields.secret;
        if (secret !== api.currentNote.getLabel("secret").value) {
            res.send(400);
            return;
        }

        const { transcription, recordedAt } = fields;
        console.log(transcription, recordedAt);

        let dateCreated = toTriliumDateString(recordedAt);
        let dayNote = api.getDayNote(dateCreated);

        let title = toHumanTime(recordedAt) + " quicknote";
        const {note} = api.createTextNote(dayNote.noteId, title, transcription);

        note.setLabel("quicknote", "");

          // for (let topic of topics) {
          //   note.setLabel("t_" + topic, "");
          // }
        // let note = api.getNote(noteId);
        // note.setContent(content);
        // note.save();
        // let notePojo = note.getPojo();
        // notePojo.content = note.getContent();
        // res.status(201).json(notePojo);
    }).catch(err => {
        console.log("multipart parse error:", err);
        res.status(400).send('bad request');
    });
}