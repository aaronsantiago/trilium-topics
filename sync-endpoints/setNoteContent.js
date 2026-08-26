const { req, res } = api;

if (req.method == "OPTIONS") {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  console.log("Received OPTIONS request, sent CORS headers");
  res.send(200);
}
else if (req.method == "POST") {

  const { secret, noteId, content, topics, isTodo, todoDone } = req.body;

  if (secret === api.currentNote.getLabel("secret").value) {
    let note = api.getNote(noteId);

    if (topics != null) {
        for (let topic of topics) {
            note.setLabel("t_" + topic, "");
        }
        let noteTopics = note.ownedAttributes.filter(
            a => a.name?.startsWith("t_") && a.name?.length > 2).map(a => a.name?.slice(2));

        for (let noteTopic of noteTopics) {
            if (!topics.includes(noteTopic)) {
                note.removeLabel("t_" + noteTopic);
            }
        }
    }

    if (isTodo != null) {
        if (isTodo) {
            note.setLabel("todo");
        }
        else {
            note.removeLabel("todo");
        }

        if (todoDone != null) {
            if (todoDone) {
                note.setLabel("done");
            }
            else {
                note.removeLabel("done");
            }
        }
    }

    note.setContent(content);
    note.save();

    let notePojo = note.getPojo();
    notePojo.content = note.getContent();
    res.status(201).json(notePojo);
  } else {
    res.send(400);
  }
}
