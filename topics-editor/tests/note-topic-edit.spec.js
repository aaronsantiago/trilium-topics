import { test, expect } from "@playwright/test";
import { setupApp } from "./helpers/app.js";
import { TRILIUM_URL } from "./helpers/trilium.js";

// Editing a note's topics from the note page (shared TopicPicker), plus the
// other two users of the picker: the quicknote edit popup and the create page.

/** tap on touch projects, click elsewhere */
function press(locator, testInfo, options) {
  return testInfo.project.use.hasTouch ? locator.tap(options) : locator.click(options);
}

/** a locked row is aria-disabled, which Playwright won't act on unless forced */
const pressLocked = (locator, testInfo) => press(locator, testInfo, { force: true });

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

const HINT = "A note needs at least one topic";

async function expectLocked(page, topic) {
  const row = option(page, topic);
  await expect(row).toHaveAttribute("aria-disabled", "true");
  await expect(row).toHaveAttribute("aria-pressed", "true");
  await expect(row).toContainText(HINT);
  await expect(row).toBeVisible();
}

async function expectUnlocked(page, topic) {
  const row = option(page, topic);
  await expect(row).not.toHaveAttribute("aria-disabled", "true");
  await expect(row).not.toContainText(HINT);
}

test("a note's last topic can't be removed", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const trilium = await setupApp(page);
  await openNote(page, testInfo, "work", "Sprint planning");

  await press(page.getByRole("button", { name: "Edit topics" }), testInfo);
  await expectLocked(page, "work");
  await expectUnlocked(page, "home");
  // no confirm dialog any more
  await expect(page.locator("#noteTopicsPanel [role=alert]")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("last-topic-locked.png") });

  await pressLocked(option(page, "work"), testInfo);
  await expect(page.locator("#noteTopicsPanel [role=alert]")).toHaveCount(0);
  await expect(badges(page)).toHaveText(["work"]);
  await expectLocked(page, "work");

  // across a full sync cycle, nothing ever asks Trilium to drop the last topic
  await page.waitForTimeout(6500);
  await expect(badges(page)).toHaveText(["work"]);
  const sent = trilium.requestsTo("set-note").filter((b) => b.noteId === "noteWork1");
  expect(sent.filter((b) => (b.topics ?? []).length === 0)).toHaveLength(0);
  expect(trilium.notes.get("noteWork1").topics).toEqual(["work"]);

  // with a second topic, either can go; then the one left is locked
  await press(option(page, "home"), testInfo);
  await expect(badges(page)).toHaveText(["work", "home"]);
  await expectUnlocked(page, "work");
  await expectUnlocked(page, "home");
  await press(option(page, "work"), testInfo);
  await expect(badges(page)).toHaveText(["home"]);
  await expectLocked(page, "home");
  await expectUnlocked(page, "work");
  await page.screenshot({ path: testInfo.outputPath("last-topic-moved.png") });

  await expect
    .poll(
      () =>
        trilium
          .requestsTo("set-note")
          .filter((b) => b.noteId === "noteWork1")
          .map((b) => sorted(b.topics)),
      { timeout: 15000 },
    )
    .toContainEqual(["home"]);
  expect(
    trilium.requestsTo("set-note").filter((b) => b.noteId === "noteWork1" && (b.topics ?? []).length === 0),
  ).toHaveLength(0);
});

test("a multi-topic note can drop to one topic, then that one is locked", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);
  await openNote(page, testInfo, "reading", "Groceries for the office party");

  await press(page.getByRole("button", { name: "Edit topics" }), testInfo);
  for (const t of ["work", "home", "reading"]) await expectUnlocked(page, t);
  await press(option(page, "work"), testInfo);
  await press(option(page, "reading"), testInfo);
  await expect(badges(page)).toHaveText(["home"]);
  await expectLocked(page, "home");
  await pressLocked(option(page, "home"), testInfo);
  await expect(badges(page)).toHaveText(["home"]);

  await expect
    .poll(() => sorted(trilium.notes.get("noteMulti").topics), { timeout: 15000 })
    .toEqual(["home"]);
  expect(
    trilium.requestsTo("set-note").filter((b) => b.noteId === "noteMulti" && (b.topics ?? []).length === 0),
  ).toHaveLength(0);
});

test("a quicknote's only topic can still be removed (back to Unsorted)", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);

  await press(page.getByText("renew passport"), testInfo);
  const panel = page.locator("#quicknoteEditPanel");
  await expect(panel).toBeVisible();
  const home = panel.locator('[data-topic-option="home"]');
  await expect(home).toHaveAttribute("aria-pressed", "true");
  await expect(home).not.toHaveAttribute("aria-disabled", "true");
  await expect(panel).not.toContainText(HINT);
  await press(home, testInfo);
  await expect(home).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({ path: testInfo.outputPath("quicknote-last-topic.png") });
  await press(panel.getByRole("button", { name: "Done" }), testInfo);
  await expect(panel).toHaveCount(0);

  await expect
    .poll(
      () =>
        trilium
          .requestsTo("set-note")
          .filter((b) => b.noteId === "qnTodo")
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
