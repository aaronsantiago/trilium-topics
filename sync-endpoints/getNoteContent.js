const { req, res } = api;
const { secret, noteId } = req.body;

if (req.method == "POST" && secret === "secret-password") {
  let note = api.getNote(noteId);
  let notePojo = note.getPojo();
  notePojo.content = note.getContent();
  res.status(201).json(notePojo);
} else {
  res.send(400);
}
