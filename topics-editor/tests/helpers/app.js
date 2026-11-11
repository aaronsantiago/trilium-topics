// App-level helpers for Playwright specs.

import { expect } from "@playwright/test";
import { mockTrilium, TRILIUM_URL, TRILIUM_SECRET } from "./trilium.js";
import { defaultFixtures } from "../fixtures/notes.js";

/**
 * Start the app against the fake Trilium with settings already filled in,
 * and wait until the topic list has synced.
 *
 * Settings are written straight into IndexedDB (idb-keyval's default
 * `keyval-store` / `keyval`), then the page reloads so the app's hydration
 * IIFEs pick them up. Filling the Settings page instead wouldn't persist:
 * the idb write effects only run once home calls initialize().
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ fixtures?: ReturnType<typeof defaultFixtures>, path?: string }} [opts]
 * @returns the fake Trilium state (see mockTrilium)
 */
export async function setupApp(page, { fixtures = defaultFixtures(), path = "/" } = {}) {
  const trilium = await mockTrilium(page, fixtures);
  await page.goto("/");
  await page.evaluate(
    async ({ url, secret }) => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open("keyval-store");
        req.onupgradeneeded = () => req.result.createObjectStore("keyval");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put(url, "triliumUrl");
        tx.objectStore("keyval").put(secret, "triliumSecret");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { url: TRILIUM_URL, secret: TRILIUM_SECRET },
  );
  await page.reload();
  // the first sync is done once a seeded topic card renders
  await expect(page.locator(`[data-topic="${fixtures.topics[0]}"]`)).toBeVisible();
  if (path !== "/") await page.goto(path);
  return trilium;
}

/**
 * A real finger-drag scroll (touch gesture) at (x, y), via Chromium's CDP:
 * touchStart, a series of touchMoves, touchEnd. Positive dy scrolls the
 * content down (finger moves up), like a swipe up. Chromium may add a short
 * fling after the finger lifts, so the distance scrolled is roughly, not
 * exactly, dy; the helper waits for it to settle.
 *
 * (CDP Input.synthesizeScrollGesture with gestureSourceType "touch" does
 * nothing in this Chromium, so it isn't used.) Use this rather than
 * page.mouse.wheel, which doesn't exercise touch scrolling, overscroll or
 * touch-action rules.
 *
 * `dx` adds a sideways component: positive dx scrolls content right (finger
 * moves left). Pass dy = 0 for a pure sideways swipe.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function touchScroll(page, x, y, dy, { steps = 12, settleMs = 400, dx = 0 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - (dx * i) / steps, y: y - (dy * i) / steps }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(settleMs);
}

/** scrollTop of every scrollable ancestor of `selector`, innermost first —
 * handy for spotting which nested container actually moved. */
export async function scrollChain(page, selector) {
  return page.evaluate((sel) => {
    const out = [];
    let el = document.querySelector(sel);
    while (el) {
      if (el.scrollHeight > el.clientHeight) {
        const style = getComputedStyle(el);
        out.push({
          el: el.id ? `#${el.id}` : el.tagName.toLowerCase() + "." + [...el.classList].slice(0, 3).join("."),
          overflowY: style.overflowY,
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        });
      }
      el = el.parentElement;
    }
    return out;
  }, selector);
}
