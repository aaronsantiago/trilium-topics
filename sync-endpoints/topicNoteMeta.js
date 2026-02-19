const { req, res } = api;
const { secret } = req.body;

function getChildrenPojo(note, notePojo, depth = 1) {
  if (depth <= 0) return notePojo;
  let children = [];
  for (let child of note.children) {
    let childPojo = child.getPojo();
    childPojo = getChildrenPojo(child, childPojo, depth - 1);
    childPojo.attributes = {};
    for (let attribute of child.ownedAttributes) {
      childPojo.attributes[attribute.name] = attribute.value;
    }
    children.push(childPojo);
  }
  notePojo.children = children;
  return notePojo;
}

if (req.method == "POST" && secret === api.currentNote.getLabel("secret").value) {
  const targetParentNote = api.currentNote.getRelation("targetNote").targetNote;

  let notePojo = targetParentNote.getPojo();
  notePojo = getChildrenPojo(targetParentNote, notePojo, 2);

  res.status(201).json(notePojo);
} else {
  res.send(400);
}
