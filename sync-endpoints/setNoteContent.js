const { req, res } = api;
const { secret, noteId, content } = req.body;

if (req.method == "POST" && secret === api.currentNote.getLabel("secret").value) {
  let note = api.getNote(noteId);

  note.setContent(content);
  note.save();

  let notePojo = note.getPojo();
  notePojo.content = note.getContent();
  res.status(201).json(notePojo);
} else {
  res.send(400);
}
