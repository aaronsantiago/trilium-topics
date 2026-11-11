import { test, expect } from "@playwright/test";
import { setupApp, touchScroll } from "./helpers/app.js";
import { defaultFixtures } from "./fixtures/notes.js";

// "make it so that in the editor it doesn't stop before the bottom of the
// scroll ... extra whitespace to click on if i want to add lines at the bottom"
//
// The room below the text that keeps the last line clear of the FAB is
// padding inside the editable, so the editor reaches the bottom of the scroll
// and a tap there starts typing at the end.

const EDITABLE = ".ck-editor__main > .ck-editor__editable";

async function openNote(page, topic, title) {
  await page.locator(`[data-topic="${topic}"]`).click();
  await expect(page).toHaveURL(/\/topic\/$/);
  await page.getByText(title).first().click();
  await expect(page).toHaveURL(/\/note\/$/);
  await expect(page.locator(EDITABLE)).toBeVisible();
}

async function scrollToEnd(page, isMobile) {
  const vp = page.viewportSize();
  for (let i = 0; i < 20; i++) {
    const atEnd = await page.evaluate(() => {
      const sc = document.getElementById("scrollContainer");
      return sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
    });
    if (atEnd) return;
    if (isMobile) await touchScroll(page, Math.round(vp.width / 2), vp.height - 150, vp.height - 300);
    else {
      await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(150);
    }
  }
}

/** Geometry at the end of the scroll: editable bottom vs scroll box bottom, and the free space below the text. */
async function bottomGeometry(page) {
  return page.evaluate((sel) => {
    const sc = document.getElementById("scrollContainer").getBoundingClientRect();
    const ed = document.querySelector(sel);
    const er = ed.getBoundingClientRect();
    const last = ed.lastElementChild.getBoundingClientRect();
    return { scBottom: sc.bottom, edBottom: er.bottom, lastBottom: last.bottom, left: er.left, width: er.width };
  }, EDITABLE);
}

async function tapAt(page, isMobile, x, y) {
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test("long note: editor reaches the bottom; tapping the space below the text adds lines at the end", async ({ page, isMobile }, testInfo) => {
  test.setTimeout(60_000);
  const trilium = await setupApp(page);
  await openNote(page, "reading", "A very long note");
  await scrollToEnd(page, isMobile);
  await page.screenshot({ path: testInfo.outputPath("1-end.png") });

  const g = await bottomGeometry(page);
  // the editor runs to the bottom of the scroll, no dead strip under it
  expect(Math.abs(g.scBottom - g.edBottom), `editor bottom ${g.edBottom} vs scroll bottom ${g.scBottom}`).toBeLessThanOrEqual(4);
  // about the same room below the text as before (pb-28 = 112px), all tappable
  expect(g.edBottom - g.lastBottom).toBeGreaterThanOrEqual(100);
  expect(g.edBottom - g.lastBottom).toBeLessThanOrEqual(160);

  // tap in the empty space (left side, clear of the FAB) → caret at the end
  await tapAt(page, isMobile, Math.round(g.left + 40), Math.round(g.lastBottom + 50));
  await expect(page.locator(EDITABLE)).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.type("added at the bottom");
  await page.waitForTimeout(200);
  await page.screenshot({ path: testInfo.outputPath("2-typed.png") });

  const lastTwo = await page.locator(`${EDITABLE} > *`).evaluateAll((els) => els.slice(-2).map((e) => e.textContent));
  expect(lastTwo).toEqual(["End of the long note.", "added at the bottom"]);
  await expect(page.getByText("added at the bottom")).toBeInViewport();

  await expect
    .poll(() => trilium.requestsTo("set-note").map((b) => b.content ?? "").join(""), { timeout: 15_000 })
    .toContain("added at the bottom");
});

test("note ending in a table: tapping below it starts a new paragraph after the table", async ({ page, isMobile }, testInfo) => {
  const fixtures = defaultFixtures();
  fixtures.notes.find((n) => n.noteId === "noteWork1").content =
    "<p>Plan the next sprint.</p><figure class=\"table\"><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table></figure>";
  await setupApp(page, { fixtures });
  await openNote(page, "work", "Sprint planning");
  await expect(page.locator(`${EDITABLE} table`)).toBeVisible();

  const g = await bottomGeometry(page);
  await tapAt(page, isMobile, Math.round(g.left + 40), Math.round(g.lastBottom + 40));
  await expect(page.locator(EDITABLE)).toBeFocused();
  await page.keyboard.type("after the table");
  await page.waitForTimeout(200);
  await page.screenshot({ path: testInfo.outputPath("table.png") });

  const last = page.locator(`${EDITABLE} > *`).last();
  await expect(last).toHaveText("after the table");
  expect(await last.evaluate((e) => e.tagName)).toBe("P");
  await expect(page.locator(`${EDITABLE} td`).first()).toHaveText("a");
});

test("tapping inside the text still puts the caret where you tap", async ({ page, isMobile }) => {
  await setupApp(page);
  await openNote(page, "reading", "A very long note");
  const box = await page.locator(`${EDITABLE} p`).first().boundingBox();
  await tapAt(page, isMobile, Math.round(box.x + 5), Math.round(box.y + 8));
  await page.keyboard.type("XYZ");
  await expect(page.locator(`${EDITABLE} p`).first()).toContainText("XYZ");
  await expect(page.locator(`${EDITABLE} p`).last()).toHaveText("End of the long note.");
});
