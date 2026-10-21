import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const bundle = await build({
  entryPoints: ["tests/tableHighlights.browser.ts"], bundle: true, write: false,
  format: "iife", globalName: "tableTests", platform: "browser",
  plugins: [{ name: "obsidian-stub", setup(build) {
    build.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export class MarkdownRenderChild { callbacks = []; register(fn) { this.callbacks.push(fn); } unload() { this.callbacks.forEach(fn => fn()); } } export const Platform = { isMobile: false }; export const MarkdownRenderer = { render(app, text, el) { el.textContent = text; } }; export function setIcon() {}" }));
  } }],
});
const browser = await chromium.launch(process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : {});
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><head></head><body></body></html>");
  await page.addStyleTag({ content: await readFile("styles.css", "utf8") });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  console.log(await page.evaluate(() => tableTests.run()));
  console.log(await page.evaluate(() => tableTests.runPopoverAndCache()));
  const list = page.locator(".axl-popover-list");
  await list.hover();
  await page.mouse.wheel(0, 400);
  await page.waitForFunction(() => document.querySelector(".axl-popover-list").scrollTop > 0);
  await page.getByRole("button", { name: "Delete highlight", exact: true }).first().click();
  await page.waitForFunction(() => !document.querySelector(".axl-annotation-popover.is-visible"));
  console.log("Passed: actual mouse wheel scrolling and popup deletion");
} finally { await browser.close(); }
