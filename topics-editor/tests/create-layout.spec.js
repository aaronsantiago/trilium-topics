import { test, expect } from "@playwright/test";
import { setupApp } from "./helpers/app.js";
import { defaultFixtures } from "./fixtures/notes.js";

// The create page is one compact form: title, Cancel/Create right under it,
// then the topic list in its own scroll area. Create stays in view with the
// phone keyboard up (approximated by a shorter viewport) and clear of the
// bottom-right flower FAB.

/** tap on touch projects, click elsewhere */
function press(locator, testInfo) {
  return testInfo.project.use.hasTouch ? locator.tap() : locator.click();
}

const title = (page) => page.getByPlaceholder("Note title");
const createBtn = (page) => page.getByRole("button", { name: "Create", exact: true });
const cancelBtn = (page) => page.getByRole("button", { name: "Cancel", exact: true });
const topicList = (page) => page.getByRole("group", { name: "Topics" });
const topicOption = (page, topic) => page.locator(`[data-topic-option="${topic}"]`);

function manyTopicFixtures() {
  const fixtures = defaultFixtures();
  const extra = Array.from({ length: 20 }, (_, i) => `project-${String(i + 1).padStart(2, "0")}-long-topic-name`);
  fixtures.topics.push(...extra);
  extra.forEach((t, i) =>
    fixtures.notes.push({ noteId: `extra${i}`, title: `Extra ${i}`, dateCreated: "2026-10-01 09:00:00.000-0500", content: "<p>x</p>", topics: [t] }),
  );
  return { fixtures, extra };
}

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** the box is fully inside the current viewport */
async function expectFullyInViewport(page, locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
}

async function expectNoSidewaysScroll(page) {
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowX).toBeLessThanOrEqual(0);
}

async function expectClearOfFab(page) {
  const fab = await page.getByRole("button", { name: "Menu" }).boundingBox();
  for (const btn of [createBtn(page), cancelBtn(page)]) {
    expect(overlaps(await btn.boundingBox(), fab), "action covered by the FAB").toBe(false);
  }
}

async function openFlower(page) {
  await page.getByRole("button", { name: "Menu" }).click();
  const home = page.getByRole("button", { name: "Home", exact: true });
  await expect(home).toBeVisible();
  await expect.poll(() => home.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await page.waitForTimeout(300);
}

test("compact form: title, actions and topics sit close together", async ({ page }, testInfo) => {
  await setupApp(page, { path: "/create/" });
  await expect(topicOption(page, "work")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("create-3-topics.png") });

  const t = await title(page).boundingBox();
  const c = await createBtn(page).boundingBox();
  const list = await topicList(page).boundingBox();
  // title → actions → topic list, with small gaps and no empty bands
  expect(c.y).toBeGreaterThan(t.y);
  expect(c.y - (t.y + t.height)).toBeLessThan(48);
  // (between the actions and the list there's only the "Topics" heading row)
  const head = await page.locator("[data-create-selected]").boundingBox();
  expect(head.y).toBeGreaterThan(c.y + c.height);
  expect(head.y - (c.y + c.height)).toBeLessThan(48);
  expect(list.y).toBeGreaterThan(head.y + head.height);
  expect(list.y - (head.y + head.height)).toBeLessThan(24);
  // with three topics the whole form fits in the top part of the screen
  expect(list.y + list.height).toBeLessThan(page.viewportSize().height * 0.7);

  await expectFullyInViewport(page, createBtn(page));
  await expectClearOfFab(page);
  await expectNoSidewaysScroll(page);

  // desktop: a centred column, not stretched edge to edge
  if (!testInfo.project.use.isMobile) {
    const vp = page.viewportSize();
    expect(t.width).toBeLessThanOrEqual(640);
    expect(Math.abs(t.x + t.width / 2 - vp.width / 2)).toBeLessThan(24);
  }

  await openFlower(page);
  await page.screenshot({ path: testInfo.outputPath("create-flower-open.png") });
  const createBox = await createBtn(page).boundingBox();
  for (const name of ["Create note", "Settings", "Home", "Menu"]) {
    const sub = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(overlaps(createBox, sub), `${name} covers Create`).toBe(false);
  }
});

test("keyboard up (short viewport): Create stays in view and clear of the FAB", async ({ page }, testInfo) => {
  await setupApp(page, { path: "/create/" });
  const width = page.viewportSize().width;
  await page.setViewportSize({ width, height: 400 });

  await press(title(page), testInfo);
  await expect(title(page)).toBeFocused();
  await page.keyboard.type("Typed with the keyboard up");
  await press(topicOption(page, "home"), testInfo);
  await title(page).focus();
  await page.screenshot({ path: testInfo.outputPath("create-short-viewport.png") });

  await expectFullyInViewport(page, title(page));
  await expectFullyInViewport(page, createBtn(page));
  await expectClearOfFab(page);
  await expect(createBtn(page)).toBeEnabled();
  await expectNoSidewaysScroll(page);
});

test("many topics: the list scrolls inside itself, title and Create stay put", async ({ page }, testInfo) => {
  const { fixtures, extra } = manyTopicFixtures();
  const trilium = await setupApp(page, { fixtures, path: "/create/" });
  await expect(topicOption(page, "work")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("create-23-topics.png") });

  // the list is its own scroll area; the page itself doesn't scroll
  const scroller = page.locator("[data-create-topic-scroll]");
  const dims = await scroller.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, oy: getComputedStyle(el).overflowY }));
  expect(dims.sh).toBeGreaterThan(dims.ch);
  expect(dims.oy).toBe("auto");
  const pageScroll = await page.evaluate(() => {
    const sc = document.getElementById("scrollContainer");
    return sc.scrollHeight - sc.clientHeight;
  });
  expect(pageScroll).toBeLessThanOrEqual(0);
  // the bottom of the list ends above the FAB
  const fab = await page.getByRole("button", { name: "Menu" }).boundingBox();
  const sbox = await scroller.boundingBox();
  expect(sbox.y + sbox.height).toBeLessThanOrEqual(fab.y);

  await title(page).fill("Many topics");
  const titleBefore = await title(page).boundingBox();
  const last = topicOption(page, extra[19]);
  await last.scrollIntoViewIfNeeded();
  await press(last, testInfo);
  await expect(last).toHaveAttribute("aria-pressed", "true");
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  // selections that scrolled away are still summarised next to the heading
  await expect(page.locator("[data-create-selected]")).toContainText(extra[19]);
  await page.screenshot({ path: testInfo.outputPath("create-23-topics-scrolled.png") });

  expect(await title(page).boundingBox()).toEqual(titleBefore);
  await expectFullyInViewport(page, title(page));
  await expectFullyInViewport(page, createBtn(page));
  await expectNoSidewaysScroll(page);

  await press(createBtn(page), testInfo);
  await expect(page).toHaveURL(/\/note\/$/);
  await expect.poll(() => trilium.requestsTo("create-note").length, { timeout: 15000 }).toBe(1);
  expect(trilium.requestsTo("create-note")[0]).toMatchObject({ title: "Many topics", topics: [extra[19]] });
});

test("seeded from a topic: preselected, Create returns to the topic", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);
  await page.locator('[data-topic="work"]').click();
  await expect(page).toHaveURL(/\/topic\/$/);
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page).toHaveURL(/\/create\/$/);
  await expect(topicOption(page, "work")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-create-selected]")).toContainText("work");
  await expect(createBtn(page)).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("create-seeded.png") });

  await press(title(page), testInfo);
  await page.keyboard.type("Seeded note");
  await expect(createBtn(page)).toBeEnabled();
  await press(createBtn(page), testInfo);
  await expect(page).toHaveURL(/\/topic\/$/);
  await expect(page.getByText("Seeded note")).toBeVisible();
  await expect
    .poll(() => trilium.requestsTo("create-note").map((r) => [r.title, r.topics]), { timeout: 15000 })
    .toContainEqual(["Seeded note", ["work"]]);
});
