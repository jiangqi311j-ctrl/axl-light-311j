import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const bundle = await build({
  entryPoints: ["tests/tableHighlights.browser.ts"], bundle: true, write: false,
  format: "iife", globalName: "tableTests", platform: "browser",
  plugins: [{ name: "obsidian-stub", setup(build) {
    build.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export class MarkdownRenderChild {} export const Platform = { isMobile: false };" }));
  } }],
});
const browser = await chromium.launch(process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : {});
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><head></head><body></body></html>");
  await page.addStyleTag({ content: await readFile("styles.css", "utf8") });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  console.log(await page.evaluate(() => tableTests.run()));
} finally { await browser.close(); }
