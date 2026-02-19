const { req, res } = api;
const { secret, title, content, topics, dateCreated } = req.body;

if (req.method == "POST" && secret === api.currentNote.getLabel("secret").value) {
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
