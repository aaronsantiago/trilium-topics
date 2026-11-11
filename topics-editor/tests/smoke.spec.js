import { test, expect } from "@playwright/test";
import { setupApp } from "./helpers/app.js";

test("home → topic → note renders against the fake Trilium", async ({ page }, testInfo) => {
  await setupApp(page);

  // home: topics and quicknotes from the fixtures
  await expect(page.locator('[data-topic="home"]')).toBeVisible();
  await expect(page.getByText("call the plumber")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("home.png") });

  // topic view
  await page.locator('[data-topic="work"]').click();
  await expect(page).toHaveURL(/\/topic\/$/);
  await expect(page.getByText("Sprint planning")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("topic.png") });

  // note editor
  await page.getByText("Sprint planning").click();
  await expect(page).toHaveURL(/\/note\/$/);
  await expect(page.locator(".ck-editor__editable")).toContainText("Plan the next sprint.");
  await page.screenshot({ path: testInfo.outputPath("note.png") });
});
