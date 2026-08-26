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
    notePojo.topics = [];
    for (let attribute of note.ownedAttributes) {
      if (attribute.name.startsWith("t_")) {
        notePojo.topics.push(attribute.name.slice(2));
      }
    }

    notePojo.topics = [];
    notePojo.quicknote = false;
    notePojo.isTodo = false;
    notePojo.todoDone = false;

    for (let attribute of note.ownedAttributes) {
      if (attribute.name.startsWith("quicknote")) {
        notePojo.quicknote = true;
      }
      if (attribute.name == "todo") {
        notePojo.isTodo = true;
      }
      if (attribute.name == "done") {
        notePojo.todoDone = true;
      }

      if (attribute.name.startsWith("t_")) {
        notePojo.topics.push(attribute.name.slice(2));
      }
    }

    res.status(200).json(notePojo);
  } else {
    res.send(400);
  }
}
