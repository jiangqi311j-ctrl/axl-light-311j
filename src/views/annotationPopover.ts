/**
 * [INPUT]: 依赖 Obsidian MarkdownRenderer、注释/高亮数据与目标 DOM 坐标
 * [OUTPUT]: 对外提供 AnnotationPopover，显示可滚动的便签内容与删除操作，并按视口高度定位
 * [POS]: views 模块的轻量弹层，补足 sticky lane collapse 后的阅读入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { App, Component, MarkdownRenderer, setIcon } from "obsidian";

import { AnnotationColor, CommentAnnotation, HighlightAnnotation } from "../storage/types";

interface AnnotationPopoverOptions {
  app: App;
  component: Component;
  onDelete: (sourcePath: string, annotationId: string) => Promise<void>;
}

interface AnnotationPopoverItem {
  id: string;
  color: AnnotationColor;
  kind: "highlight" | "comment";
  quote: string;
  content?: string;
  author?: string;
}

interface ShowPopoverOptions {
  rect: DOMRect;
  sourcePath: string;
  items: AnnotationPopoverItem[];
}

type PopoverSource = HighlightAnnotation | CommentAnnotation;

export class AnnotationPopover {
  private readonly element: HTMLElement;

  constructor(private readonly options: AnnotationPopoverOptions) {
    this.element = document.body.createDiv({ cls: "axl-annotation-popover" });
    this.element.addEventListener("click", (event) => event.stopPropagation());
    this.hide();
  }

  destroy(): void {
    this.element.remove();
  }

  show(options: ShowPopoverOptions): void {
    this.element.empty();
    this.element.toggleClass("is-visible", true);

    const header = this.element.createDiv({ cls: "axl-popover-header" });
    header.createSpan({ cls: "axl-popover-title", text: "Annotation" });
    const close = header.createEl("button", {
      cls: "axl-icon-button",
      attr: { type: "button", title: "Close annotation popover" },
    });
    setIcon(close, "x");
    close.addEventListener("click", () => this.hide());

    const list = this.element.createDiv({ cls: "axl-popover-list" });
    for (const item of options.items) {
      this.renderItem(list, item, options.sourcePath);
    }

    this.place(options.rect);
  }

  hide(): void {
    this.element.toggleClass("is-visible", false);
    this.element.empty();
  }

  static itemFromAnnotation(annotation: PopoverSource): AnnotationPopoverItem {
    const isComment = "content" in annotation;
    return {
      id: annotation.id,
      color: annotation.color,
      kind: isComment ? "comment" : "highlight",
      quote: annotation.anchor.selectedText,
      content: isComment ? annotation.content : undefined,
      author: isComment ? annotation.author : undefined,
    };
  }

  private renderItem(container: HTMLElement, item: AnnotationPopoverItem, sourcePath: string): void {
    const card = container.createDiv({
      cls: "axl-popover-card",
      attr: {
        "data-axl-color": item.color,
        "data-axl-id": item.id,
      },
    });

    const meta = card.createDiv({ cls: "axl-popover-meta" });
    meta.createSpan({ cls: "axl-color-chip", text: item.color, attr: { "data-axl-color": item.color } });
    meta.createSpan({ text: item.kind === "comment" ? item.author ?? "Reader" : "highlight only" });

    card.createDiv({ cls: "axl-popover-quote", text: item.quote });
    const actions = card.createDiv({ cls: "axl-popover-actions" });
    const remove = actions.createEl("button", {
      text: item.kind === "highlight" ? "Delete highlight" : "Delete note",
      attr: { type: "button" },
    });
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      try {
        await this.options.onDelete(sourcePath, item.id);
        this.hide();
      } catch (error) {
        remove.disabled = false;
        console.error("Axl Light: unable to delete annotation", error);
      }
    });
    if (!item.content) {
      card.createDiv({ cls: "axl-popover-empty", text: "No sticky note attached yet." });
      return;
    }

    const body = card.createDiv({ cls: "axl-popover-body" });
    MarkdownRenderer.render(this.options.app, item.content, body, sourcePath, this.options.component);
  }

  private place(rect: DOMRect): void {
    const win = this.element.ownerDocument.defaultView!;
    const width = Math.min(360, win.innerWidth - 24);
    this.element.style.width = `${width}px`;
    this.element.style.maxHeight = `${Math.min(420, win.innerHeight - 24)}px`;
    const height = this.element.getBoundingClientRect().height;
    const left = clamp(rect.left + rect.width / 2 - width / 2, 12, win.innerWidth - width - 12);
    const below = rect.bottom + 10;
    const preferredTop = below + height <= win.innerHeight - 12 ? below : rect.top - height - 10;
    const top = clamp(preferredTop, 12, Math.max(12, win.innerHeight - height - 12));
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
