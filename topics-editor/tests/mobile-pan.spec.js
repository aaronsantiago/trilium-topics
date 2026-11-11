import { test, expect } from "@playwright/test";
import { setupApp, touchScroll } from "./helpers/app.js";
import { defaultFixtures } from "./fixtures/notes.js";

// "remove the ability to horizontally pan on mobile"
//
// The page itself must never scroll sideways (html, body, #scrollContainer);
// the intentional sideways scrollers (home topic strip, quicknote rows,
// todos strip) still must.

const WIDE =
  "<pre><code>" + "wide_code_line_".repeat(20) + "</code></pre>" +
  "<table><tbody><tr>" + "<td>wide_table_cell_content</td>".repeat(10) + "</tr></tbody></table>";

/** defaultFixtures + wide content in noteLong + enough topics to overflow the home strip */
function fixtures() {
  const fx = defaultFixtures();
  fx.notes.find((n) => n.noteId === "noteLong").content += WIDE;
  const extra = ["garden", "travel", "recipes", "finance", "health", "music", "projects"];
  fx.topics.push(...extra);
  extra.forEach((t, i) =>
    fx.notes.push({
      noteId: `noteExtra${i}`,
      title: `Notes about ${t}`,
      dateCreated: `2026-10-${10 + i} 09:00:00.000-0500`,
      content: `<p>${t} things</p>`,
      topics: [t],
    }),
  );
  return fx;
}

async function widths(page) {
  return page.evaluate(() => {
    const sc = document.getElementById("scrollContainer");
    return {
      html: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
      body: [document.body.scrollWidth, document.documentElement.clientWidth],
      sc: [sc.scrollWidth, sc.clientWidth],
    };
  });
}

async function pagePan(page) {
  return page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollLeft: document.getElementById("scrollContainer").scrollLeft,
    vvLeft: Math.round(window.visualViewport?.offsetLeft ?? 0),
  }));
}

const routes = {
  home: async () => {},
  topic: async (page) => {
    await page.locator('[data-topic="reading"]').click();
    await expect(page).toHaveURL(/\/topic\/$/);
  },
  note: async (page) => {
    await page.locator('[data-topic="reading"]').click();
    await page.getByText("A very long note").first().click();
    await expect(page).toHaveURL(/\/note\/$/);
    await expect(page.locator(".ck-editor__editable_inline")).toContainText("wide_table_cell_content");
  },
  create: async (page) => {
    await page.goto("/create/");
    await expect(page.getByRole("button", { name: "Create", exact: true })).toBeVisible();
  },
  settings: async (page) => {
    await page.goto("/settings/");
  },
};

for (const [name, go] of Object.entries(routes)) {
  test(`${name}: the page doesn't overflow or pan sideways`, async ({ page, isMobile }, testInfo) => {
    await setupApp(page, { fixtures: fixtures() });
    await go(page);
    await page.waitForTimeout(800); // masonry / editor layout settles

    const w = await widths(page);
    expect(w.html[0], `html scrollWidth ${JSON.stringify(w)}`).toBeLessThanOrEqual(w.html[1]);
    expect(w.body[0], `body scrollWidth ${JSON.stringify(w)}`).toBeLessThanOrEqual(w.body[1]);
    expect(w.sc[0], `#scrollContainer scrollWidth ${JSON.stringify(w)}`).toBeLessThanOrEqual(w.sc[1]);

    if (isMobile) {
      // a sideways swipe across the middle of the page, both directions
      const vp = page.viewportSize();
      for (const dx of [250, -250]) {
        const x = dx > 0 ? vp.width - 40 : 40;
        await touchScroll(page, x, Math.round(vp.height * 0.6), 0, { dx });
        expect(await pagePan(page)).toEqual({ scrollX: 0, scrollLeft: 0, vvLeft: 0 });
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  });
}

test("home: the topic strip still scrolls sideways", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, "the strip is a vertical column on desktop");
  await setupApp(page, { fixtures: fixtures() });
  const strip = page.locator("[data-topic]").first().locator("xpath=..");
  const box = await strip.boundingBox();
  const sizes = await strip.evaluate((e) => [e.scrollWidth, e.clientWidth]);
  expect(sizes[0], "strip overflows, so there's something to scroll").toBeGreaterThan(sizes[1]);

  await touchScroll(page, box.x + box.width - 40, box.y + box.height / 2, 0, { dx: 250 });
  const left = await strip.evaluate((e) => e.scrollLeft);
  expect(left).toBeGreaterThan(50);
  expect(await pagePan(page)).toEqual({ scrollX: 0, scrollLeft: 0, vvLeft: 0 });
  await page.screenshot({ path: testInfo.outputPath("strip-scrolled.png") });
});

test("note: wide code blocks and tables wrap to the screen", async ({ page }) => {
  await setupApp(page, { fixtures: fixtures() });
  await routes.note(page);
  // CKEditor wraps pre (pre-wrap) and table cells; neither should push the page wider
  const vw = page.viewportSize().width;
  for (const sel of ["pre", "figure.table", "table"]) {
    const right = await page.locator(`.ck-editor__editable_inline ${sel}`).first().evaluate((e) => e.getBoundingClientRect().right);
    expect(right, sel).toBeLessThanOrEqual(vw);
  }
});

test("desktop home: the Recent panel scrolls sideways inside itself", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await setupApp(page, { fixtures: fixtures() });
  // it used to be wider than the window, so only panning the whole page reached its right edge
  const panel = page.getByText("Recent", { exact: true }).locator("xpath=..");
  const box = await panel.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  await panel.evaluate((e) => (e.scrollLeft = e.scrollWidth));
  expect(await panel.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
  await expect(panel.locator(".card").last()).toBeInViewport({ ratio: 0.9 });
});
