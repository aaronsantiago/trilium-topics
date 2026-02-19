import {
  defineLauncherWidget,
  useActiveNoteContext,
  useState,
  useEffect,
  useRef,
} from "trilium:preact";

async function getTopics() {
  // looks through all of the notes in the topicsParentNote, and finds
  // the list of topics based on their name
  const topics = await api.runOnBackend(() => {
    let topics = [];
    let topicsParentNote =
      api.currentNote.getRelation("topicsParentNote").targetNote;

    for (let topicNote of topicsParentNote.children) {
      topics.push(topicNote.title);
    }
    return topics;
  });

  return topics;
}

async function createTopicNote(params) {
  const path = await api.runOnBackend((params) => {
    const todayNote = api.getTodayNote();
    const { branch, note } = api.createTextNote(
      todayNote.noteId,
      params.title,
      "",
    );
    // get the clone of the note that is in the calendar
    let path = note.getBestNotePathString(todayNote.noteId);
    for (let topic of params.topics) {
      note.setAttribute("label", "t_" + topic);
    }
    return path;
  }, [params]);
  await api.waitUntilSynced();
  await api.activateNote(path);
}

function topicToggle({
  topicName,
  topicEnabled,
  topicSetEnabled,
  ...restProps
}) {
  return <button>{topicName}</button>;
}

export default defineLauncherWidget({
  render: () => {
    const [open, setOpen] = useState(false);
    const { note } = useActiveNoteContext();
    const popupRef = useRef(null);
    const buttonRef = useRef(null);

    const [topics, setTopics] = useState([]);
    const [selectedTopics, setSelectedTopics] = useState([]);

    const titleInputRef = useRef(null);
    const newTopicsInputRef = useRef(null);

    useEffect(() => {
      if (open) {
        // reset state when opening the popup
        setSelectedTopics([]);
        titleInputRef.current.value = "";
        newTopicsInputRef.current.value = "";
      }
    }, [open])

    useEffect(() => {
      (async () => {
        const topics = await getTopics();
        setTopics(topics);
      })();
    }, []);

    // Handle clicks outside the popup
    useEffect(() => {
      if (!open) return;

      const handleClickOutside = (event) => {
        // Close if clicking outside both the popup and the trigger button
        if (
          popupRef.current &&
          !popupRef.current.contains(event.target) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target)
        ) {
          setOpen(false);
        }
      };

      // Use capture phase to ensure we catch the event early
      document.addEventListener("mousedown", handleClickOutside, true);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside, true);
      };
    }, [open]);

    return (
      <>
        <button
          ref={buttonRef}
          onClick={() => setOpen((a) => !a)}
          style={{
            display: "flex",
            height: "53px",
            width: "fit-content",
            fontSize: "0.75em",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          new topic note
        </button>

        {/* popup for creating a new note*/}
        {open && (
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              left: "var(--launcher-pane-size)",
              top: "60px",
              width: "200px",
              margin: "16px",
              height: "600px",
              overflowY: "auto",
              background: "#1e1e1e",
              border: "1px solid #444",
              borderRadius: "4px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              zIndex: 1000,
            }}
          >
            <div style={{ position: "sticky", top: "0", marginBottom: "16px", background: "#1e1e1e", width: "100%" }}>
              <input ref={titleInputRef} placeholder="New note title" style={{ width: "100%", padding: "8px", boxSizing: "border-box", marginBottom: "8px" }} />
              <input ref={newTopicsInputRef} placeholder="New topics" style={{ width: "100%", fontSize: "0.5rem", padding: "8px", boxSizing: "border-box", marginBottom: "8px" }} />
              <button onClick={() => {
                const title = titleInputRef.current.value;
                const newTopics = newTopicsInputRef.current.value.split(" ").map(t => t.trim()).filter(t => t.length > 0);
                createTopicNote({ title, topics: [...newTopics, ...selectedTopics] });
                setOpen(false);
              }}>
                Create New Note
              </button>
            </div>
            {/* list all topics*/}
            {topics.map((topic) => (
              <>
                {selectedTopics.includes(topic) ? (
                  // show selected topics with a different style, click to deselect
                  <button
                    onClick={() =>
                      setSelectedTopics((prev) =>
                        prev.filter((t) => t !== topic),
                      )
                    }
                    style={{
                      display: "block",
                      width: "100%",
                      marginBottom: "8px",
                      padding: "8px",
                      background: "#4a90e2",
                      color: "#fff",
                    }}
                  >
                    {topic}
                  </button>
                ) : (
                  // click to select topics
                  <button
                    onClick={() => setSelectedTopics((prev) => [...prev, topic])}
                    style={{
                      display: "block",
                      width: "100%",
                      marginBottom: "8px",
                      padding: "8px",
                    }}
                  >
                    {topic}
                  </button>
                )}
              </>
            ))}
          </div>
        )}
        {/* </popup>*/}

      </>
    );
  },
});
