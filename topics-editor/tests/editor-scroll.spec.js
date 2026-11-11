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

// "make sure that scrolling happens in a way that keeps the toolbar at the
// top". The CKEditor toolbar is position: sticky inside #scrollContainer, so
// it stays pinned whether or not the editor has focus (CKEditor's own sticky
// panel only pinned while focused, against the window, which doesn't scroll).

const TOOLBAR_BAR = ".ck-editor__top .ck-toolbar";

async function toolbarBox(page) {
  return page.locator(TOOLBAR_BAR).boundingBox();
}

/** The toolbar is pinned at the top: y ≈ 0, fully on screen, and on top of the text there. */
async function expectPinned(page, label) {
  const box = await toolbarBox(page);
  expect(Math.abs(box.y), `${label}: toolbar top ${box.y}`).toBeLessThanOrEqual(3);
  expect(box.y + box.height, label).toBeLessThanOrEqual(page.viewportSize().height);
  const hit = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".ck-editor__top"), {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  });
  expect(hit, `${label}: toolbar is drawn over the scrolled text`).toBe(true);
}

/** Scroll the page down by touch (mobile) or wheel (desktop) until the toolbar has had to stick. */
async function scrollDownPastTitle(page, isMobile) {
  for (let i = 0; i < 2; i++) await userScroll(page, isMobile, 600);
  const st = await page.evaluate(() => document.getElementById("scrollContainer").scrollTop);
  expect(st, "page scrolled").toBeGreaterThan(300);
}

test("toolbar stays pinned at the top while scrolling, focused or not", async ({ page, isMobile }, testInfo) => {
  test.setTimeout(60_000);
  const trilium = await setupApp(page);
  await openNote(page, "reading", "A very long note");
  const vp = page.viewportSize();

  // at the top: toolbar in its normal place, below the title and badges (mobile)
  const atTop = await toolbarBox(page);
  await expect(page.locator(TITLE)).toBeInViewport();
  if (isMobile) {
    const badges = await page.locator("#noteTopics").boundingBox();
    expect(atTop.y, "toolbar below the badges").toBeGreaterThanOrEqual(badges.y + badges.height);
  }
  const firstLine = await page.locator(`${EDITABLE} h2`).first().boundingBox();
  expect(firstLine.y, "first line of text below the toolbar").toBeGreaterThanOrEqual(atTop.y + atTop.height);
  await page.screenshot({ path: testInfo.outputPath("toolbar-1-top.png") });

  // 1. no focus: scroll down; nothing focused the editor
  await scrollDownPastTitle(page, isMobile);
  await expect(page.locator(".ck-editor__editable_inline")).not.toBeFocused();
  await expectPinned(page, "unfocused");
  await page.screenshot({ path: testInfo.outputPath("toolbar-2-middle-unfocused.png") });

  // keep going to the end: still pinned
  await scrollUntil(page, isMobile, 600, `${EDITABLE} p:has-text("End of the long note.")`);
  await expectPinned(page, "unfocused, bottom");
  await page.screenshot({ path: testInfo.outputPath("toolbar-3-bottom-unfocused.png") });

  // 2. focus: tap into the text and type; still pinned, caret line not under it
  await tapNearBottom(page, isMobile);
  await page.keyboard.type(" pinned");
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Enter");
    await page.keyboard.type(`line ${i}`);
  }
  await page.waitForTimeout(200);
  await expectPinned(page, "focused");
  await page.screenshot({ path: testInfo.outputPath("toolbar-4-focused.png") });

  // scroll up a bit while focused: still pinned (CKEditor's own sticky would
  // fight here if it were still on)
  await userScroll(page, isMobile, -400);
  await expectPinned(page, "focused, after scrolling up");
  await expect(page.locator(".ck-sticky-panel__content_sticky")).toHaveCount(0);

  // 3. a shorter viewport, standing in for the phone keyboard
  await page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.55) });
  await page.waitForTimeout(300);
  await page.keyboard.type(" kb");
  await page.waitForTimeout(200);
  await expectPinned(page, "short viewport");
  // the caret line is visible below the toolbar, not hidden behind it
  const caret = await page.evaluate(() => {
    const r = getSelection().getRangeAt(0).getClientRects()[0] ?? getSelection().focusNode.parentElement.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });
  const tb = await toolbarBox(page);
  expect(caret.top, "caret below the pinned toolbar").toBeGreaterThanOrEqual(tb.y + tb.height - 1);
  expect(caret.bottom, "caret above the bottom edge").toBeLessThanOrEqual(page.viewportSize().height);
  await page.screenshot({ path: testInfo.outputPath("toolbar-5-short-viewport.png") });
  await page.setViewportSize(vp);

  // back to the top: toolbar back in place under the title, nothing hidden
  await scrollUntil(page, isMobile, -600, TITLE);
  await scrollUntil(page, isMobile, -600, `${EDITABLE} h2`);
  await expect(page.locator(TITLE)).toBeInViewport();
  const backTop = await toolbarBox(page);
  const h2 = await page.locator(`${EDITABLE} h2`).first().boundingBox();
  expect(h2.y, "first line not under the toolbar").toBeGreaterThanOrEqual(backTop.y + backTop.height);
  if (isMobile) expect(Math.abs(backTop.y - atTop.y), "toolbar back where it started").toBeLessThanOrEqual(3);
  await page.screenshot({ path: testInfo.outputPath("toolbar-6-back-at-top.png") });

  await expect.poll(() => trilium.requestsTo("set-note").length, { timeout: 15_000 }).toBeGreaterThan(0);
});

test("toolbar: dropdowns open over the pinned toolbar; FAB and topics popup stay on top", async ({ page, isMobile }, testInfo) => {
  test.setTimeout(60_000);
  await setupApp(page);
  await openNote(page, "reading", "A very long note");
  await scrollDownPastTitle(page, isMobile);
  await expectPinned(page, "before dropdown");

  // heading dropdown opens below the pinned toolbar and isn't clipped
  await page.locator(".ck-heading-dropdown > button").click();
  const panel = page.locator(".ck-heading-dropdown .ck-dropdown__panel");
  await expect(panel).toBeVisible();
  const pb = await panel.boundingBox();
  const tb = await toolbarBox(page);
  expect(pb.y, "panel opens below the toolbar (CKEditor overlaps it a few px)").toBeGreaterThanOrEqual(tb.y + tb.height - 6);
  await expect(panel.getByText("Heading 2")).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("dropdown-heading.png") });
  await page.keyboard.press("Escape");

  // flower FAB doesn't collide with the pinned toolbar, and opens above everything
  const fab = await page.getByRole("button", { name: "Menu" }).boundingBox();
  expect(fab.y).toBeGreaterThan(tb.y + tb.height);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("fab-open.png") });
  await page.mouse.click(5, Math.round(page.viewportSize().height / 2));

  // topics popup (fixed, z-40) sits above the pinned toolbar
  await scrollUntil(page, isMobile, -600, '[aria-label="Edit topics"]');
  await page.getByRole("button", { name: "Edit topics" }).click();
  await scrollUntil(page, isMobile, 600, `${EDITABLE} p:nth-of-type(20)`);
  const pinned = await toolbarBox(page);
  const onTop = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest(".ck-editor__top") === null,
    { x: Math.round(pinned.x + pinned.width / 2), y: Math.round(pinned.y + pinned.height / 2) },
  );
  expect(onTop, "topics popup covers the toolbar").toBe(true);
  await page.screenshot({ path: testInfo.outputPath("topics-popup.png") });
});
