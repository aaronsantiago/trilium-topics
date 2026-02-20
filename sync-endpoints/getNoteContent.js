const { req, res } = api;

if (req.method == "OPTIONS") {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  console.log("Received OPTIONS request, sent CORS headers");
  res.send(200);
}
else if (req.method == "POST") {

  const { secret, noteId } = req.body;

  if (secret === api.currentNote.getLabel("secret").value) {
    let note = api.getNote(noteId);
    let notePojo = note.getPojo();
    notePojo.content = note.getContent();
    res.status(200).json(notePojo);
  } else {
    res.send(400);
  }
}
