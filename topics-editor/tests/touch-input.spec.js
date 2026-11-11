import { test, expect } from "@playwright/test";
import { setupApp } from "./helpers/app.js";

// Touch/mouse input after the gamepad + T9 layer was removed: the phone
// keyboard must be able to open everywhere and every action must be tappable.

/** tap on touch projects, click elsewhere */
function press(locator, testInfo) {
  return testInfo.project.use.hasTouch ? locator.tap() : locator.click();
}

test("note editor accepts native typing and syncs it", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);

  await press(page.locator('[data-topic="work"]'), testInfo);
  await expect(page).toHaveURL(/\/topic\/$/);
  await press(page.getByText("Sprint planning"), testInfo);
  await expect(page).toHaveURL(/\/note\/$/);

  const editable = page.locator(".ck-editor__editable");
  await expect(editable).toContainText("Plan the next sprint.");
  // inputmode="none" is what used to keep the phone keyboard closed
  await expect(editable).not.toHaveAttribute("inputmode", "none");
  await expect(page.locator(".custom-cursor")).toHaveCount(0);

  await press(editable.getByText("Plan the next sprint."), testInfo);
  await expect(editable).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.type(" Typed on a phone.");
  await expect(editable).toContainText("Typed on a phone.");
  await page.screenshot({ path: testInfo.outputPath("note-typed.png") });

  await expect
    .poll(() => trilium.requestsTo("set-note").map((b) => b.content).join("\n"), { timeout: 15000 })
    .toContain("Typed on a phone.");
});

test("home quicknote input submits on Enter and keeps focus", async ({ page }, testInfo) => {
  const trilium = await setupApp(page);

  const input = page.locator("#quicknoteInputField");
  await expect(input).not.toHaveAttribute("inputmode", "none");
  await press(input, testInfo);
  await expect(input).toBeFocused();
  await page.keyboard.type("buy more coffee");
  await page.screenshot({ path: testInfo.outputPath("quicknote-typing.png") });
  await page.keyboard.press("Enter");

  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(page.getByText("buy more coffee")).toBeVisible();

  await expect
    .poll(() => trilium.requestsTo("index-create").map((b) => b.transcription), { timeout: 15000 })
    .toContain("buy more coffee");
});

test("create page: tap topics on and off, then create", async ({ page }, testInfo) => {
  const trilium = await setupApp(page, { path: "/create/" });

  await press(page.getByPlaceholder("Note title"), testInfo);
  await page.keyboard.type("Groceries");

  const create = page.getByRole("button", { name: "Create", exact: true });
  await expect(create).toBeDisabled();

  await press(page.locator('[data-topic="work"]'), testInfo);
  await press(page.locator('[data-topic="home"]'), testInfo);
  await press(page.locator('[data-topic="reading"]'), testInfo);
  // tapping a selected topic deselects it
  await press(page.locator('[data-topic="work"]'), testInfo);
  await expect(page.locator('[data-topic="work"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-topic="home"]')).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: testInfo.outputPath("create.png") });

  await expect(create).toBeEnabled();
  await press(create, testInfo);
  await expect(page).toHaveURL(/\/note\/$/);

  await expect
    .poll(() => trilium.requestsTo("create-note").length, { timeout: 15000 })
    .toBeGreaterThan(0);
  const body = trilium.requestsTo("create-note")[0];
  expect(body.title).toBe("Groceries");
  expect([...body.topics].sort()).toEqual(["home", "reading"]);
});

test("flower menu navigates by tap", async ({ page }, testInfo) => {
  await setupApp(page);

  const destinations = [
    ["Create note", /\/create\/$/],
    ["Settings", /\/settings\/$/],
    ["Home", /\/$/],
  ];
  for (const [label, url] of destinations) {
    await press(page.getByRole("button", { name: "Menu" }), testInfo);
    const target = page.getByRole("button", { name: label, exact: true });
    await expect(target).toBeVisible();
    if (label === "Create note") await page.screenshot({ path: testInfo.outputPath("menu-open.png") });
    await press(target, testInfo);
    await expect(page).toHaveURL(url);
  }
  await expect(page.locator('[data-topic="work"]')).toBeVisible();
});
