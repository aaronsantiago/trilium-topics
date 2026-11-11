import { test, expect } from "@playwright/test";
import { setupApp, touchScroll, scrollChain } from "./helpers/app.js";

// "If the editor scrolls too far on mobile I can't scroll back to the top
// anymore. Long notes basically become unusable."
//
// The note page used to have nested scroll boxes, one of them overflow-hidden
// (finger can't scroll it, but CKEditor's caret-following could). These specs
// drive the page only with real input (finger drags / wheel, taps at
// coordinates, typing) so nothing but the app scrolls the page.

const TITLE = "h1";
const TOOLBAR = ".ck-editor__top";
const EDITABLE = ".ck-editor__editable";

async function openNote(page, topic, title) {
  await page.locator(`[data-topic="${topic}"]`).click();
  await expect(page).toHaveURL(/\/topic\/$/);
  await page.getByText(title).first().click();
  await expect(page).toHaveURL(/\/note\/$/);
  await expect(page.locator(EDITABLE)).toBeVisible();
}

/** Scroll like a user would: finger drag on mobile, mouse wheel on desktop. */
async function userScroll(page, isMobile, dy) {
  const vp = page.viewportSize();
  const x = Math.round(vp.width / 2);
  if (isMobile) {
    // drag across most of the screen, starting low for a swipe up and vice versa
    const d = Math.sign(dy) * Math.min(Math.abs(dy), vp.height - 300);
    const y = dy > 0 ? vp.height - 150 : 150;
    await touchScroll(page, x, y, d);
  } else {
    await page.mouse.move(x, Math.round(vp.height / 2));
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(150);
  }
}

async function chain(page) {
  return JSON.stringify(await scrollChain(page, `${EDITABLE} p:last-child`), null, 1);
}

async function scrollUntil(page, isMobile, dy, selector, max = 15) {
  const target = page.locator(selector).first();
  for (let i = 0; i < max; i++) {
    // toBeInViewport accounts for clipping by scroll boxes; boundingBox doesn't
    const visible = await expect(target)
      .toBeInViewport({ ratio: 0.9, timeout: 300 })
      .then(() => true, () => false);
    if (visible) return true;
    await userScroll(page, isMobile, dy);
  }
  return false;
}

/** Tap (or click) on the text line nearest the bottom of the visible area. */
async function tapNearBottom(page, isMobile) {
  const vp = page.viewportSize();
  const point = await page.evaluate(
    ({ sel, h }) => {
      const ps = [...document.querySelectorAll(`${sel} p`)];
      // last paragraph whose middle is really on screen (not clipped away)
      for (const p of ps.reverse()) {
        const r = p.getBoundingClientRect();
        const pt = { x: r.left + 20, y: r.top + Math.min(r.height / 2, 12) };
        if (pt.y <= 0 || pt.y >= h - 40) continue;
        const hit = document.elementFromPoint(pt.x, pt.y);
        if (hit && p.contains(hit)) return pt;
      }
      return null;
    },
    { sel: EDITABLE, h: vp.height },
  );
  expect(point, "a visible paragraph to tap").not.toBeNull();
  if (isMobile) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect(page.locator(EDITABLE)).toBeFocused();
}

for (const { noteId, topic, title } of [
  { noteId: "noteLong", topic: "reading", title: "A very long note" },
  { noteId: "noteMulti", topic: "work", title: "Groceries for the office party" },
]) {
  test(`${noteId}: scroll down, type near the end, scroll back to the top`, async ({ page, isMobile }, testInfo) => {
    test.setTimeout(90_000);
    const fixtures = (await import("./fixtures/notes.js")).defaultFixtures();
    // noteMulti gets a long body too, so its three topic badges sit above a long note
    if (noteId === "noteMulti") {
      const long = fixtures.notes.find((n) => n.noteId === "noteLong");
      fixtures.notes.find((n) => n.noteId === "noteMulti").content = long.content;
    }
    const trilium = await setupApp(page, { fixtures });
    await openNote(page, topic, title);
    await expect(page.locator(TITLE)).toHaveText(title);
    await page.screenshot({ path: testInfo.outputPath("1-top.png") });

    // scroll well down
    for (let i = 0; i < 2; i++) await userScroll(page, isMobile, 600);
    await page.screenshot({ path: testInfo.outputPath("2-middle.png") });

    // all the way to the end
    const reachedEnd = await scrollUntil(page, isMobile, 600, `${EDITABLE} p:has-text("End of the long note.")`);
    await page.screenshot({ path: testInfo.outputPath("3-bottom.png") });
    expect(reachedEnd, `end of note reachable; chain: ${await chain(page)}`).toBe(true);
    await expect(page.getByText("End of the long note.")).toBeInViewport();

    // put the caret near the end and type, with a couple of new lines
    await tapNearBottom(page, isMobile);
    await page.keyboard.type(" typed");
    await page.keyboard.press("Enter");
    await page.keyboard.type("more text");
    await page.keyboard.press("Enter");
    await page.keyboard.type("and more");
    await page.waitForTimeout(200);
    await page.screenshot({ path: testInfo.outputPath("4-after-typing.png") });

    // and back up, by finger
    // the top of the text, not just the title: on desktop the title panel is sticky
    const reachedTop = await scrollUntil(page, isMobile, -600, `${EDITABLE} h2`);
    await page.screenshot({ path: testInfo.outputPath("5-back-at-top.png") });
    expect(reachedTop, `title reachable again; chain: ${await chain(page)}`).toBe(true);
    await expect(page.locator(TITLE), `chain: ${await chain(page)}`).toBeInViewport();
    await expect(page.locator(TOOLBAR), `chain: ${await chain(page)}`).toBeInViewport();
    await expect(page.locator(`[data-topic], .badge`).first()).toBeInViewport();

    // the edit was kept and synced
    await expect(page.locator(EDITABLE)).toContainText("and more");
    await expect.poll(() => trilium.requestsTo("set-note").length, { timeout: 15_000 }).toBeGreaterThan(0);

    // and the end is still reachable afterwards
    const reachedEndAgain = await scrollUntil(page, isMobile, 600, `${EDITABLE} p:has-text("and more")`);
    expect(reachedEndAgain, `end reachable again; chain: ${await chain(page)}`).toBe(true);
  });
}
