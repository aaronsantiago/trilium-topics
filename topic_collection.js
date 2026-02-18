api.log("AARON - executing topic_collection.js")
// this script checks the tagged note for a t_ attribute, and if it's present
// branches the note to a matching child in a topics note, a topic note.
// if the topic note does not exist, it creates it.

// to use, this script should have a relation set to the topics note
// where all of the topic notes will be created.

// notes to be checked to be branched into topic notes should add the
// ~runOnAttributeChange relation with this script as a target

let topicsParentNote = api.currentNote.getRelation("topicsParentNote").targetNote;

api.log("AARON - retrieved targetNote")

// gets the note that triggered this script to run, grabs all of its
// topic attributes (ones that start with t_)
const note = api.originEntity.note;
let attributeNames = note.ownedAttributes.filter(
    a => a.name.startsWith("t_") && a.name.length > 2).map(a => a.name.slice(2));
let attributeNamesMap = {};

// looks through all of the notes in the topicsParentNote, and branches
// the note to the ones that match. we keep track of which attributes
// match so that we can create the note later if they don't match
for (let topicNote of topicsParentNote.children) {
    if (attributeNames.includes(topicNote.title)) {
        api.ensureNoteIsPresentInParent(note.noteId, topicNote.noteId);
        attributeNamesMap[topicNote.title] = true;
    }
    else {
        api.ensureNoteIsAbsentFromParent(note.noteId, topicNote.noteId);
    }

    if (topicNote.children.length == 0) {
        topicNote.deleteNote();
    }
}

// creates any topic notes that do not exist, and adds the note to them
for (let attributeName of attributeNames) {
    if (!attributeNamesMap[attributeName]) {
        api.log("AARON - topic note not found: " + attributeName);
        let branchAndNote = api.createNewNote({
                parentNoteId: topicsParentNote.noteId,
                title: attributeName,
                content: "",
                type: "book"
            });
        api.log("AARON - topic note created");

        api.ensureNoteIsPresentInParent(note.noteId, branchAndNote.note.noteId);
    }
}
