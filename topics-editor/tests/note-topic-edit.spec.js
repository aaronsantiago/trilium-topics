import { test, expect } from "@playwright/test";
import { setupApp } from "./helpers/app.js";
import { TRILIUM_URL } from "./helpers/trilium.js";

// Editing a note's topics from the note page (shared TopicPicker), plus the
// other two users of the picker: the quicknote edit popup and the create page.

/** tap on touch projects, click elsewhere */
function press(locator, testInfo) {
  return testInfo.project.use.hasTouch ? locator.tap() : locator.click();
}

const sorted = (list) => [...(list ?? [])].sort();

async function openNote(page, testInfo, topic, title) {
  await press(page.locator(`[data-topic="${topic}"]`), testInfo);
  await expect(page).toHaveURL(/\/topic\/$/);
  await press(page.getByText(title), testInfo);
  await expect(page).toHaveURL(/\/note\/$/);
  await expect(page.locator(".ck-editor__editable")).toBeVisible();
}

const badges = (page) => page.locator("#noteTopics .badge");
const option = (page, topic) => page.locator(`#noteTopicsPanel [data-topic-option="${topic}"]`);

test("add a topic to a note from the note page", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);
  await openNote(page, testInfo, "work", "Sprint planning");
  await expect(page.locator(".ck-editor__editable")).toContainText("Plan the next sprint.");
  await expect(badges(page)).toHaveText(["work"]);
  await page.screenshot({ path: testInfo.outputPath("note-closed.png") });

  const edit = page.getByRole("button", { name: "Edit topics" });
  await expect(edit).toBeEnabled();
  await press(edit, testInfo);
  await expect(page.locator("#noteTopicsPanel")).toBeVisible();
  // opening the picker must not focus the editor (would pop the phone keyboard)
  await expect(page.locator(".ck-editor__editable")).not.toBeFocused();
  await expect(option(page, "work")).toHaveAttribute("aria-pressed", "true");
  await expect(option(page, "home")).toHaveAttribute("aria-pressed", "false");

  await press(option(page, "home"), testInfo);
  // optimistic: badges update before any sync
  await expect(badges(page)).toHaveText(["work", "home"]);
  await expect(option(page, "home")).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: testInfo.outputPath("note-picker-open.png") });

  // tap outside the panel to dismiss
  const vp = page.viewportSize();
  if (testInfo.project.use.hasTouch) await page.touchscreen.tap(100, vp.height - 60);
  else await page.mouse.click(100, vp.height - 60);
  await expect(page.locator("#noteTopicsPanel")).toHaveCount(0);
  await expect(page.locator(".ck-editor__editable")).toContainText("Plan the next sprint.");

  await expect
    .poll(
      () =>
        trilium
          .requestsTo("set-note")
          .filter((b) => b.noteId === "noteWork1")
          .map((b) => ({ topics: sorted(b.topics), content: b.content })),
      { timeout: 15000 },
    )
    .toContainEqual({ topics: ["home", "work"], content: "<p>Plan the next sprint.</p>" });
  await page.screenshot({ path: testInfo.outputPath("note-after.png") });

  // after the next sync the note shows on the home topic page
  await page.goBack();
  await page.goBack();
  await expect(page.locator('[data-topic="home"]')).toBeVisible();
  await press(page.locator('[data-topic="home"]'), testInfo);
  await expect(page).toHaveURL(/\/topic\/$/);
  await expect(page.getByText("Sprint planning")).toBeVisible({ timeout: 15000 });
});

test("remove a topic from a multi-topic note", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);
  await openNote(page, testInfo, "reading", "Groceries for the office party");
  await expect(badges(page)).toHaveText(["work", "home", "reading"]);

  await press(page.getByRole("button", { name: "Edit topics" }), testInfo);
  await press(option(page, "reading"), testInfo);
  await expect(badges(page)).toHaveText(["work", "home"]);
  await press(page.getByRole("button", { name: "Done" }), testInfo);
  await expect(page.locator("#noteTopicsPanel")).toHaveCount(0);

  await expect
    .poll(
      () =>
        trilium
          .requestsTo("set-note")
          .filter((b) => b.noteId === "noteMulti")
          .map((b) => ({ topics: sorted(b.topics), content: b.content })),
      { timeout: 15000 },
    )
    .toContainEqual({ topics: ["home", "work"], content: "<p>Chips, salsa, sparkling water.</p>" });
  expect(sorted(trilium.notes.get("noteMulti").topics)).toEqual(["home", "work"]);
});

test("removing a note's last topic asks first", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);
  await openNote(page, testInfo, "work", "Sprint planning");

  await press(page.getByRole("button", { name: "Edit topics" }), testInfo);
  await press(option(page, "work"), testInfo);
  const warning = page.locator("#noteTopicsPanel [role=alert]");
  await expect(warning).toContainText("last topic");
  await page.screenshot({ path: testInfo.outputPath("last-topic-confirm.png") });
  // nothing changed yet
  await expect(badges(page)).toHaveText(["work"]);

  await press(page.getByRole("button", { name: "Keep" }), testInfo);
  await expect(warning).toHaveCount(0);
  await expect(badges(page)).toHaveText(["work"]);

  await press(option(page, "work"), testInfo);
  await press(page.getByRole("button", { name: "Remove" }), testInfo);
  await expect(badges(page)).toHaveCount(0);

  await expect
    .poll(
      () =>
        trilium
          .requestsTo("set-note")
          .filter((b) => b.noteId === "noteWork1")
          .map((b) => b.topics),
      { timeout: 15000 },
    )
    .toContainEqual([]);
});

test("topic control is disabled until the note's content is loaded", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);

  // a note that appears on the server later, whose get-note is held
  trilium.notes.set("noteSlow", {
    noteId: "noteSlow",
    title: "Slow note",
    dateCreated: "2026-11-07 09:00:00.000-0500",
    dateModified: "2026-11-07 09:00:00.000-0500",
    content: "<p>Slow content.</p>",
    topics: ["work"],
    quicknote: false,
    isTodo: false,
    todoDone: false,
  });
  let release;
  const held = new Promise((r) => (release = r));
  await page.route(`${TRILIUM_URL}/custom/get-note`, async (route) => {
    if (route.request().postDataJSON()?.noteId === "noteSlow") await held;
    await route.fallback();
  });

  // open it straight away (selectedNoteId is persisted in idb), before its content lands
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("keyval-store");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put("noteSlow", "selectedNoteId");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto("/note/");

  const edit = page.getByRole("button", { name: "Edit topics" });
  await expect(edit).toBeDisabled();
  await expect(page.locator("#noteTopics")).toContainText("Loading note");
  await page.screenshot({ path: testInfo.outputPath("note-loading.png") });

  // a direct /note load doesn't sync (only home's initialize() does), so go
  // home through the menu to fetch it, then come back to the note
  release();
  await press(page.getByRole("button", { name: "Menu" }), testInfo);
  await press(page.getByRole("button", { name: "Home", exact: true }), testInfo);
  await expect(page.locator('[data-topic="work"]')).toBeVisible();
  await expect.poll(() => trilium.requestsTo("get-note").some((b) => b.noteId === "noteSlow")).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/note\/$/);
  await expect(page.locator(".ck-editor__editable")).toContainText("Slow content.");
  await expect(edit).toBeEnabled({ timeout: 15000 });
  await expect(page.locator("#noteTopics")).not.toContainText("Loading note");
  expect(trilium.requestsTo("set-note").filter((b) => b.noteId === "noteSlow")).toHaveLength(0);
});

test("quicknote edit popup still stages topics through the shared picker", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);

  await press(page.getByText("call the plumber"), testInfo);
  const panel = page.locator("#quicknoteEditPanel");
  await expect(panel).toBeVisible();
  await press(panel.locator('[data-topic-option="home"]'), testInfo);
  await expect(panel.locator('[data-topic-option="home"]')).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: testInfo.outputPath("quicknote-popup.png") });
  await press(panel.getByRole("button", { name: "Done" }), testInfo);
  await expect(panel).toHaveCount(0);

  await expect
    .poll(
      () =>
        trilium
          .requestsTo("set-note")
          .filter((b) => b.noteId === "qnUnsorted")
          .map((b) => b.topics),
      { timeout: 15000 },
    )
    .toContainEqual(["home"]);
});
