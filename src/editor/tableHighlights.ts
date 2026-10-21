/**
 * [INPUT]: CodeMirror widget DOM、源文本偏移与 sidecar 标注
 * [OUTPUT]: TableHighlights，为实时预览表格注册非侵入式 CSS Range 高亮
 * [POS]: editor 模块的表格组件投影层，不修改组件 DOM 或 Markdown 原文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { EditorView } from "@codemirror/view";
import { ANNOTATION_COLORS } from "../storage/types";
import { findRenderedAnchorRanges, type ReadingMark } from "./readingViewHighlight";

type HighlightWindow = Window & {
  Highlight?: new (...ranges: Range[]) => unknown;
  CSS?: { highlights?: Map<string, unknown> };
};

type PaintedMark = { mark: ReadingMark; ranges: Range[] };
const owners = new Map<TableHighlights, PaintedMark[]>();

export class TableHighlights {
  private readonly observer: MutationObserver;
  private frame: number | null = null;
  private readonly win: Window;

  constructor(private readonly view: EditorView, private readonly getMarks: () => ReadingMark[]) {
    this.win = view.dom.ownerDocument.defaultView!;
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(view.contentDOM, { childList: true, subtree: true, characterData: true });
    owners.set(this, []);
    this.schedule();
  }

  schedule(): void {
    if (this.frame !== null) return;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    });
  }

  destroy(): void {
    this.observer.disconnect();
    if (this.frame !== null) this.win.cancelAnimationFrame(this.frame);
    owners.delete(this);
    this.publish();
  }

  private render(): void {
    const painted: PaintedMark[] = [];
    const source = this.view.state.doc;
    for (const table of Array.from(this.view.contentDOM.querySelectorAll<HTMLElement>("table"))) {
      // A table widget replaces the whole Markdown table. CM maps its DOM to
      // either boundary, depending on the active cell and Obsidian version.
      let position: number;
      try { position = this.view.posAtDOM(table); } catch { continue; }
      let first = source.lineAt(position).number;
      if (!source.line(first).text.includes("|") && first > 1) first -= 1;
      if (!source.line(first).text.includes("|")) continue;
      let last = first;
      while (first > 1 && source.line(first - 1).text.includes("|")) first -= 1;
      while (last < source.lines && source.line(last + 1).text.includes("|")) last += 1;
      const from = source.line(first).from;
      const to = source.line(last).to;
      for (const mark of this.getMarks()) {
        if (mark.orphaned || !mark.anchor.selectedText || mark.anchor.startOffset < from || mark.anchor.endOffset > to) continue;
        const preceding = source.sliceString(from, mark.anchor.startOffset);
        const occurrence = preceding.split(mark.anchor.selectedText).length - 1;
        const ranges = findRenderedAnchorRanges(table, mark.anchor, occurrence);
        if (ranges.length) painted.push({ mark, ranges });
      }
    }
    owners.set(this, painted);
    this.publish();
  }

  private publish(): void {
    const win = this.win as HighlightWindow;
    const registry = win.CSS?.highlights;
    const Highlight = win.Highlight;
    if (!registry || !Highlight) return;
    for (const color of ANNOTATION_COLORS) {
      const ranges: Range[] = [];
      for (const [owner, marks] of owners) {
        if (owner.win !== this.win) continue;
        for (const painted of marks) {
          if (painted.mark.color === color) ranges.push(...painted.ranges);
        }
      }
      const name = `axl-table-${color}`;
      if (ranges.length) registry.set(name, new Highlight(...ranges));
      else registry.delete(name);
    }
  }
}

/** Custom highlights have no DOM element; hit-test ranges for comment popovers. */
export function tableHighlightAtPoint(event: MouseEvent): { id: string; rect: DOMRect } | null {
  for (const marks of owners.values()) {
    for (const { mark, ranges } of marks) {
      for (const range of ranges) {
        const target = event.target as Node | null;
        if (!target || range.startContainer.ownerDocument !== target.ownerDocument) continue;
        if (!range.startContainer.parentElement?.closest("table")?.contains(target)) continue;
        for (const rect of Array.from(range.getClientRects())) {
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return { id: mark.id, rect };
          }
        }
      }
    }
  }
  return null;
}

/** Refresh on sidecar changes even when CM has no document/selection update. */
export function refreshTableHighlights(): void {
  for (const owner of owners.keys()) owner.schedule();
}
