const { req, res } = api;
const { secret, title, content, topics, dateCreated } = req.body;

if (req.method == "OPTIONS") {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  console.log("Received OPTIONS request, sent CORS headers");
  res.send(200);
}
else if (req.method == "POST" && secret === api.currentNote.getLabel("secret").value) {
  let dayNote = api.getDayNote(dateCreated);

  const {note} = api.createTextNote(dayNote.noteId, title, content);

  for (let topic of topics) {
    note.setLabel("t_" + topic, "");
  }

  let notePojo = note.getPojo();
  notePojo.content = note.getContent();
  res.status(201).json(notePojo);
} else {
  res.send(400);
}
