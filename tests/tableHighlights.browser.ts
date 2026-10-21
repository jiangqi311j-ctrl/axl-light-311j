import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { TableHighlights, tableHighlightAtPoint } from "../src/editor/tableHighlights";
import { createTextAnchor } from "../src/anchor/textAnchor";
import { refreshReadingViewHighlights } from "../src/editor/readingViewHighlight";
import type { ReadingMark } from "../src/editor/readingViewHighlight";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const wait = () => new Promise((resolve) => setTimeout(resolve, 60));
async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (check()) return;
    await wait();
  }
  assert(check(), "timed out waiting for table painting");
}
const registry = (CSS as typeof CSS & { highlights: Map<string, Set<Range>> }).highlights;
const text = "前文相同\n\n| 名称 | 说明 |\n| --- | --- |\n| 相同 | 相同 |\n\n另一张表\n\n| 名称 | 说明 |\n| --- | --- |\n| 相同 | 内容 |";
const firstStart = text.indexOf("| 名称");
const firstEnd = text.indexOf("\n\n另一张表");
const secondStart = text.lastIndexOf("| 名称");
const selected = text.indexOf("相同 |", text.indexOf("| 相同")) + "相同 | ".length;
let marks: ReadingMark[] = [{ id: "comment", color: "yellow", anchor: createTextAnchor(text, selected, selected + 2) }];
class TableWidget extends WidgetType {
  toDOM() {
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>名称</th><th>说明</th></tr></thead><tbody><tr><td>相同</td><td><strong>相</strong>同</td></tr></tbody>";
    return table;
  }
}
function makeView() {
  return new EditorView({
    parent: document.body,
    state: EditorState.create({ doc: text, extensions: [EditorView.decorations.of(Decoration.set([
      Decoration.replace({ widget: new TableWidget(), block: true }).range(firstStart, firstEnd),
      Decoration.replace({ widget: new TableWidget(), block: true }).range(secondStart, text.length),
    ]))] }),
  });
}

export async function run() {
  assert(registry, "CSS Highlight API must be available");
  const view = makeView();
  const layer = new TableHighlights(view, () => marks);
  await waitFor(() => registry.has("axl-table-yellow"));
  let ranges = Array.from(registry.get("axl-table-yellow") ?? []);
  assert(ranges.map((range) => range.toString()).join("") === "相同", "split formatted text is highlighted: " + JSON.stringify({ranges:ranges.map(r=>r.toString()), selected, anchor:marks[0].anchor, positions:Array.from(view.contentDOM.querySelectorAll("table")).map(t=>view.posAtDOM(t))}));
  const table = view.contentDOM.querySelector("table")!;
  assert(ranges.every((range) => table.rows[1].cells[1].contains(range.startContainer)), "correct occurrence and correct table");
  assert(!table.querySelector("mark"), "widget DOM stays unchanged");
  const rect = ranges[0].getBoundingClientRect();
  assert(tableHighlightAtPoint({ target: table, clientX: rect.x + 1, clientY: rect.y + 1 } as MouseEvent)?.id === "comment", "comment hit testing");
  table.rows[1].cells[1].innerHTML = "<em>相同</em>";
  await wait();
  ranges = Array.from(registry.get("axl-table-yellow") ?? []);
  assert(ranges.length === 1 && ranges[0].startContainer.parentElement?.tagName === "EM", "widget redraw restores ranges");
  marks = [{ ...marks[0], color: "blue" }];
  layer.schedule();
  await wait();
  assert(!registry.has("axl-table-yellow") && registry.has("axl-table-blue"), "color changes clear old ranges");
  const secondView = makeView();
  const secondLayer = new TableHighlights(secondView, () => marks);
  await wait();
  layer.destroy(); view.destroy();
  assert(registry.has("axl-table-blue"), "closing one editor preserves other editor highlights");
  marks = [];
  secondLayer.schedule();
  await wait();
  assert(!registry.has("axl-table-blue"), "deleted annotations clear ranges");
  secondLayer.destroy(); secondView.destroy();
  const preview = document.createElement("div");
  preview.innerHTML = "<table><tr><td>表格<strong>文字</strong></td></tr></table>";
  const anchor = createTextAnchor("表格文字", 0, 4);
  refreshReadingViewHighlights(preview, [{ id: "reading", color: "green", anchor }]);
  assert(preview.querySelectorAll("mark").length === 2, "reading view table highlights still work");
  return "Passed: table matching, repeated text, formatted cells, comment hit testing, redraw, colors, multiple editors, deletion, Reading View";
}
