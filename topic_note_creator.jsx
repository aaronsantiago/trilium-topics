import { defineLauncherWidget, useActiveNoteContext, useState, useEffect, useRef } from "trilium:preact";

async function createTopicNote(params) {
    const path = await api.runOnBackend(() => {
        const todayNote = api.getTodayNote();
        const {branch, note} = api.createTextNote(
            todayNote.noteId,
            "New Note !!!!",
            "",
        )
        // get the clone of the note that is in the calendar
        let path = note.getBestNotePathString(todayNote.noteId);
        note.setAttribute("label", "t_test");
        return path;
    });
    await api.waitUntilSynced();
    await api.activateNote(path);
}

function topicToggle({topicName, topicEnabled, topicSetEnabled,...restProps}) {
    return <button>{topicName}</button>
}

export default defineLauncherWidget({
    render: () => {
        const [open, setOpen] = useState(false);
        const { note } = useActiveNoteContext();
        const popupRef = useRef(null);
        const buttonRef = useRef(null);

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
            document.addEventListener('mousedown', handleClickOutside, true);

            return () => {
                document.removeEventListener('mousedown', handleClickOutside, true);
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
                        flexShrink: 0
                    }}
                >
                    {note?.title}
                </button>

                {open && (
                    <div
                        ref={popupRef}
                        style={{
                            position: "fixed",
                            left: "100px",
                            top: "60px",
                            width: "300px",
                            padding: "16px",
                            background: "#1e1e1e",
                            border: "1px solid #444",
                            borderRadius: "4px",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                            zIndex: 1000
                        }}
                    >
                        <button
                            onClick={createTopicNote}
                            style={{ display: "block", width: "100%", marginBottom: "8px", padding: "8px" }}
                        >
                            Button 1
                        </button>
                    </div>
                )}
            </>
        );
    }
});
