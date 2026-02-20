const { req, res } = api;

function getChildrenPojo(note, notePojo, depth = 1) {
  if (depth <= 0) return notePojo;
  let children = [];
  for (let child of note.children) {
    let childPojo = child.getPojo();
    childPojo = getChildrenPojo(child, childPojo, depth - 1);
    childPojo.topics = [];
    for (let attribute of child.ownedAttributes) {
      if (attribute.name.startsWith("t_")) {
        childPojo.topics.push(attribute.name.slice(2));
      }
    }
    children.push(childPojo);
  }
  notePojo.children = children;
  return notePojo;
}

if (req.method == "OPTIONS") {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  console.log("Received OPTIONS request, sent CORS headers");
  res.send(200);
}
else if (req.method == "POST") {

  const { secret } = req.body;

  if (secret === api.currentNote.getLabel("secret").value) {
    const targetParentNote = api.currentNote.getRelation("targetNote").targetNote;

    let notePojo = targetParentNote.getPojo();
    notePojo = getChildrenPojo(targetParentNote, notePojo, 2);

    res.status(201).json(notePojo);
  }
  else {
    res.send(400);
  }
} else {
  res.send(400);
}
