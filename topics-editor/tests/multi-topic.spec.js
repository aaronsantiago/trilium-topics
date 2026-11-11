import { test, expect } from "@playwright/test";
import { setupApp } from "./helpers/app.js";

// Creating a note with several topics, end to end: create → sync → shows on
// home (Recent), every topic page and the note page → edit → go back.

const TOPICS = ["work", "home", "reading"];

/** tap on touch projects, click elsewhere */
function press(locator, testInfo) {
  return testInfo.project.use.hasTouch ? locator.tap() : locator.click();
}

/** fail the test on any uncaught page error or Svelte/console error */
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || text.includes("each_key_duplicate")) errors.push(msg.type() + ": " + text);
  });
  return errors;
}

/** delay one endpoint of the fake Trilium (registered after setupApp, so it runs first) */
async function delayEndpoint(page, endpoint, ms) {
  await page.route(`http://trilium.test/custom/${endpoint}`, async (route) => {
    if (route.request().method() !== "OPTIONS") await new Promise((r) => setTimeout(r, ms));
    await route.fallback();
  });
}

async function openCreatePage(page, testInfo) {
  await press(page.getByRole("button", { name: "Menu" }), testInfo);
  await press(page.getByRole("button", { name: "Create note" }), testInfo);
  await expect(page).toHaveURL(/\/create\/$/);
}

/** fill the create form with a title and topics, press Create, land on /note */
async function createViaUi(page, testInfo, title, topics, screenshot) {
  await openCreatePage(page, testInfo);
  await page.getByPlaceholder("Note title").fill(title);
  for (const t of topics) await press(page.locator(`[data-topic-option="${t}"]`), testInfo);
  for (const t of topics) await expect(page.locator(`[data-topic-option="${t}"]`)).toHaveAttribute("aria-pressed", "true");
  if (screenshot) await page.screenshot({ path: testInfo.outputPath(screenshot) });
  await press(page.getByRole("button", { name: "Create", exact: true }), testInfo);
  await expect(page).toHaveURL(/\/note\/$/);
  const editable = page.locator(".ck-editor__editable");
  await expect(editable).toBeVisible();
  return editable;
}

const createdBodies = (trilium, title) => trilium.requestsTo("create-note").filter((b) => b.title === title);
const serverNote = (trilium, title) => [...trilium.notes.values()].find((n) => n.title === title);

test("create a note with three topics, sync, view everywhere, edit", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const trilium = await setupApp(page);
  const title = "Multi topic plan";

  const editable = await createViaUi(page, testInfo, title, TOPICS, "create-3-topics.png");
  await press(editable, testInfo);
  await page.keyboard.type("First line written on the phone.");
  await expect(page.locator(".badge", { hasText: "reading" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("note-new.png") });

  // sent once, with every topic and the typed content
  await expect.poll(() => createdBodies(trilium, title).length, { timeout: 15000 }).toBe(1);
  expect(createdBodies(trilium, title)[0].topics).toEqual(TOPICS);
  await expect.poll(() => serverNote(trilium, title)?.content ?? "", { timeout: 15000 }).toContain("First line");
  const realId = serverNote(trilium, title).noteId;
  // let the post-create sleep + refresh (temp id → real id) and another tick pass
  await page.waitForTimeout(6000);
  expect(createdBodies(trilium, title).length).toBe(1);

  // home → Recent shows it once
  await press(page.getByRole("button", { name: "Menu" }), testInfo);
  await press(page.getByRole("button", { name: "Home" }), testInfo);
  await expect(page.locator(`[data-note-id="${realId}"]`)).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("home-recent.png") });

  // every topic page shows it once
  for (const t of TOPICS) {
    await press(page.locator(`[data-topic="${t}"]`), testInfo);
    await expect(page).toHaveURL(/\/topic\/$/);
    await expect(page.locator(`[data-note-id="${realId}"]`)).toHaveCount(1);
    // the card lists every topic, so the current one is always among them
    await expect(page.locator(`[data-note-id="${realId}"] [data-testid="note-topics"]`)).toHaveText(TOPICS.join(" · "));
    await page.screenshot({ path: testInfo.outputPath(`topic-${t}.png`) });
    await page.goBack();
    await expect(page.locator(`[data-topic="${t}"]`)).toBeVisible();
  }

  // open it from a topic page, edit, go back
  await press(page.locator('[data-topic="home"]'), testInfo);
  await press(page.locator(`[data-note-id="${realId}"]`), testInfo);
  await expect(page).toHaveURL(/\/note\/$/);
  await expect(editable).toContainText("First line written on the phone.");
  for (const t of TOPICS) await expect(page.locator(".badge", { hasText: t })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("note-reopened.png") });
  await press(editable.getByText("First line"), testInfo);
  await page.keyboard.press("End");
  await page.keyboard.type(" Edited later.");
  await expect
    .poll(() => trilium.requestsTo("set-note").filter((b) => b.noteId === realId).map((b) => b.content).join("\n"), { timeout: 15000 })
    .toContain("Edited later.");
  // the edit keeps all three topics
  expect(trilium.notes.get(realId).topics).toEqual(TOPICS);
  await page.goBack();
  await expect(page).toHaveURL(/\/topic\/$/);
  await expect(page.locator(`[data-note-id="${realId}"]`)).toContainText("Edited later.");
  await page.screenshot({ path: testInfo.outputPath("topic-after-edit.png") });

  expect(createdBodies(trilium, title).length).toBe(1);
  expect(errors).toEqual([]);
});

test("typing while a slow create-note is in flight isn't lost or duplicated", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const trilium = await setupApp(page);
  // every topic is another label write on the server — make create slow
  await delayEndpoint(page, "create-note", 6000);
  const title = "Slow create";

  const editable = await createViaUi(page, testInfo, title, TOPICS);
  await press(editable, testInfo);
  await page.keyboard.type("before upload.");
  // wait for the upload to start, then keep typing while it's in flight
  await expect.poll(() => createdBodies(trilium, title).length, { timeout: 10000 }).toBeGreaterThan(0);
  await page.keyboard.type(" During upload.");
  // and again in the post-create sleep/refresh window
  await expect.poll(() => serverNote(trilium, title) != null, { timeout: 15000 }).toBe(true);
  await page.keyboard.type(" After create.");

  const realId = () => serverNote(trilium, title)?.noteId;
  await expect
    .poll(() => trilium.notes.get(realId())?.content ?? "", { timeout: 25000 })
    .toContain("During upload. After create.");
  await page.waitForTimeout(6000);
  expect(createdBodies(trilium, title).length).toBe(1);
  expect([...trilium.notes.values()].filter((n) => n.title === title).length).toBe(1);
  await expect(editable).toContainText("before upload. During upload. After create.");
  expect(errors.filter((e) => !e.includes("Injected"))).toEqual([]);
});

test("a failed create-note is retried and creates exactly one note", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const trilium = await setupApp(page);
  trilium.failNext("create-note");
  const title = "Retry create";

  const editable = await createViaUi(page, testInfo, title, TOPICS);
  await press(editable, testInfo);
  await page.keyboard.type("Survives a 500.");

  await expect.poll(() => serverNote(trilium, title)?.content ?? "", { timeout: 20000 }).toContain("Survives a 500.");
  await page.waitForTimeout(6000);
  expect(createdBodies(trilium, title).length).toBe(2); // the 500, then one retry
  expect([...trilium.notes.values()].filter((n) => n.title === title).length).toBe(1);
  expect(trilium.notes.get(serverNote(trilium, title).noteId).topics).toEqual(TOPICS);
  // only the expected failure is logged (browser 500 + the app's error log)
  expect(errors.filter((e) => !/500|create-note/i.test(e))).toEqual([]);
});

test("topic picker with many topics stays usable on a phone", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const fixtures = (await import("./fixtures/notes.js")).defaultFixtures();
  const extra = Array.from({ length: 20 }, (_, i) => `project-${String(i + 1).padStart(2, "0")}-long-topic-name`);
  fixtures.topics.push(...extra);
  extra.forEach((t, i) =>
    fixtures.notes.push({ noteId: `extra${i}`, title: `Extra ${i}`, dateCreated: "2026-10-01 09:00:00.000-0500", content: "<p>x</p>", topics: [t] }),
  );
  const trilium = await setupApp(page, { fixtures });
  await openCreatePage(page, testInfo);
  await page.getByPlaceholder("Note title").fill("Many topics");
  const picks = ["work", "home", "reading", ...extra.slice(0, 5), extra[19]];
  for (const t of picks) {
    const item = page.locator(`[data-topic-option="${t}"]`);
    await item.scrollIntoViewIfNeeded();
    await press(item, testInfo);
    await expect(item).toHaveAttribute("aria-pressed", "true");
  }
  await page.screenshot({ path: testInfo.outputPath("create-many-topics.png") });
  // no horizontal page scroll; Create still reachable
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowX).toBeLessThanOrEqual(0);
  const create = page.getByRole("button", { name: "Create", exact: true });
  await create.scrollIntoViewIfNeeded();
  await expect(create).toBeInViewport();
  await press(create, testInfo);
  await expect(page).toHaveURL(/\/note\/$/);
  await page.screenshot({ path: testInfo.outputPath("note-many-topics.png") });
  await expect.poll(() => trilium.requestsTo("create-note").length, { timeout: 15000 }).toBe(1);
  expect(trilium.requestsTo("create-note")[0].topics).toEqual(picks);
  expect(errors).toEqual([]);
});
