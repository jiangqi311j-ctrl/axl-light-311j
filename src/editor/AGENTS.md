# editor/
> L2 | 父级: /Users/epiphanyxiao/Documents/Playground/obsidian-annotation-plugin/src/AGENTS.md

成员清单
tableHighlights.ts: 实时预览表格 CSS Range 高亮、重绘恢复、多编辑器清理与点击命中，不修改表格 DOM。
highlightExtension.ts: CodeMirror 6 Decoration 高亮层，只渲染视觉标记不修改文档。
readingViewHighlight.ts: Reading View DOM 高亮层，使用最新 store 数据，清理删除残影，跳过 CM 表格，兼容延迟渲染。
selectionToolbar.ts: 浮动选择工具栏，提供颜色、便签、复制与总览入口。

法则: 编辑器只投影·原文不写入·交互从选区出发·便签管理归入总览面板

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
