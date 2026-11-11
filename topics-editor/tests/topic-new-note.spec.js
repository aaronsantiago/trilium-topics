import { test, expect } from "@playwright/test";
import { setupApp } from "./helpers/app.js";

async function openTopic(page, topic) {
  await page.locator(`[data-topic="${topic}"]`).click();
  await expect(page).toHaveURL(/\/topic\/$/);
}

const newNoteButton = (page) => page.getByRole("button", { name: "New note" });
const topicOption = (page, topic) => page.locator(`[data-topic-option="${topic}"]`);

test("New note from a topic preselects it and returns to the topic", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);
  await openTopic(page, "work");
  await expect(newNoteButton(page)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("topic-with-button.png") });

  // the button must not overlap the flower-menu FAB trigger
  const btn = await newNoteButton(page).boundingBox();
  const fab = await page.getByRole("button", { name: "Menu" }).boundingBox();
  const overlap =
    btn.x < fab.x + fab.width && fab.x < btn.x + btn.width &&
    btn.y < fab.y + fab.height && fab.y < btn.y + btn.height;
  expect(overlap).toBe(false);

  // open the flower too, and check its sub-buttons stay clear of ours
  await page.getByRole("button", { name: "Menu" }).click();
  const home = page.getByRole("button", { name: "Home", exact: true });
  await expect(home).toBeVisible();
  // wait for the flower's open transition so boxes are final
  await expect
    .poll(() => home.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("topic-flower-open.png") });
  for (const name of ["Create note", "Settings", "Home"]) {
    const sub = await page.getByRole("button", { name, exact: true }).boundingBox();
    const hit =
      btn.x < sub.x + sub.width && sub.x < btn.x + btn.width &&
      btn.y < sub.y + sub.height && sub.y < btn.y + btn.height;
    expect(hit, `${name} overlaps New note`).toBe(false);
  }
  // close the flower again
  await page.locator("body").click({ position: { x: 200, y: 60 } });

  await newNoteButton(page).click();
  await expect(page).toHaveURL(/\/create\/$/);
  await expect(topicOption(page, "work")).toHaveAttribute("aria-pressed", "true");
  await expect(topicOption(page, "home")).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({ path: testInfo.outputPath("create-seeded.png") });

  await page.getByPlaceholder("Note title").fill("Retro notes");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page).toHaveURL(/\/topic\/$/);
  await expect(page.getByText("Retro notes")).toBeVisible();
  await expect(page.getByText("Sprint planning")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("topic-after-create.png") });

  await expect
    .poll(() => trilium.requestsTo("create-note").map((r) => [r.title, r.topics]))
    .toContainEqual(["Retro notes", ["work"]]);
});

test("Cancel from a seeded create page returns to the topic", async ({ page }) => {
  const trilium = await setupApp(page);
  await openTopic(page, "home");
  await newNoteButton(page).click();
  await expect(topicOption(page, "home")).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/topic\/$/);
  await expect(page.getByText("renew passport").first()).toBeVisible();
  expect(trilium.requestsTo("create-note")).toHaveLength(0);
});

test("Create from the flower menu starts empty, even after visiting a topic", async ({ page }) => {
  await setupApp(page);
  // seed and consume once, then come back home
  await openTopic(page, "work");
  await newNoteButton(page).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/topic\/$/);

  // a plain topic visit (selectedTopic is sticky) followed by the flower
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await openTopic(page, "reading");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/create\/$/);

  await expect(topicOption(page, "work")).toBeVisible();
  await expect(page.locator('[data-topic-option][aria-pressed="true"]')).toHaveCount(0);

  // cancel without a seed goes home
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/$/);
});
