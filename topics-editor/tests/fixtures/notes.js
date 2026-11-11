// Seed data for the fake Trilium in tests/helpers/trilium.js.
// Each note mirrors the getPojo() shape the real sync endpoints return, plus
// the fields getTopicNotes.js / getNoteContent.js add (topics, quicknote,
// isTodo, todoDone). `content` is only sent by get-note, never by
// get-topic-notes. Topic order on the home page follows `topics` order.

const longParagraphs = Array.from(
  { length: 60 },
  (_, i) =>
    `<p>Paragraph ${i + 1}: the quick brown fox jumps over the lazy dog while the editor keeps scrolling further down the page.</p>`,
).join("");

export function defaultFixtures() {
  return {
    topics: ["work", "home", "reading"],
    notes: [
      {
        noteId: "noteWork1",
        title: "Sprint planning",
        dateCreated: "2026-11-01 09:00:00.000-0500",
        content: "<p>Plan the next sprint.</p>",
        topics: ["work"],
      },
      {
        noteId: "noteMulti",
        title: "Groceries for the office party",
        dateCreated: "2026-11-02 12:00:00.000-0500",
        content: "<p>Chips, salsa, sparkling water.</p>",
        topics: ["work", "home", "reading"],
      },
      {
        noteId: "noteLong",
        title: "A very long note",
        dateCreated: "2026-11-03 18:30:00.000-0500",
        content: `<h2>Start of the long note</h2>${longParagraphs}<p>End of the long note.</p>`,
        topics: ["reading"],
      },
      {
        noteId: "qnUnsorted",
        title: "November 4 - 8:15AM - 2026 quicknote",
        dateCreated: "2026-11-04 08:15:00.000-0500",
        content: "<p>call the plumber</p>",
        topics: [],
        quicknote: true,
      },
      {
        noteId: "qnTodo",
        title: "November 5 - 10:00AM - 2026 quicknote",
        dateCreated: "2026-11-05 10:00:00.000-0500",
        content: "<p>renew passport</p>",
        topics: ["home"],
        quicknote: true,
        isTodo: true,
      },
      {
        noteId: "qnDone",
        title: "November 6 - 7:45PM - 2026 quicknote",
        dateCreated: "2026-11-06 19:45:00.000-0500",
        content: "<p>return library books</p>",
        topics: ["reading"],
        quicknote: true,
        isTodo: true,
        todoDone: true,
      },
    ],
  };
}
