# axure-to-frontend

## 中文说明

`axure-to-frontend` 是一个 Codex skill，用于将 Axure RP 11 导出的 HTML 原型目录还原为响应式 TypeScript 前端项目。

本仓库只包含 `axure-to-frontend` 这个 skill，不包含示例原型、生成后的前端项目或其它业务代码。

### 功能

该 skill 会指导 Codex 分析 Axure 导出目录，并按用户选择的还原深度生成前端项目，支持：

- React/Vue + Vite + TypeScript 项目生成。
- Ant Design、Element Plus、Ant Design Vue 组件映射。
- 响应式自适应还原，而不是机械复制 Axure 的固定像素 CSS。
- 执行 Axure `data.js`，递归抽取动态面板、中继器、表格、复选框、按钮和交互目标。
- 分析后选择“静态可见页面还原”或“完整原型还原”。
- 识别 Axure 中只表示页面状态的页面，例如左侧菜单展开态，并合并为组件状态。
- 对非标准 Axure 组合控件做语义识别，例如复制到多页的菜单、用 label 做的按钮、表单/工具栏组合、上传区域、弹窗和隐藏面板。
- 强制做代码结构、样式、数据/文本三层还原校验，避免只靠截图视觉判断。
- 在语义推断前锁定内容、控件、样式结构三类证据，避免改写菜单文字、把输入框还原成标签、或给复选框添加原型中不存在的外框。

### 目录结构

```text
axure-to-frontend/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── axure-analysis.md
│   ├── axure-official-capabilities.md
│   └── frontend-mapping.md
└── scripts/
    └── inspect_axure_export.py
```

### 安装

将仓库克隆到 Codex skills 目录：

```bash
git clone https://github.com/tianyi092-jcza/axure-to-frontend.git ~/.codex/skills/axure-to-frontend
```

Windows 默认目录通常是：

```powershell
git clone https://github.com/tianyi092-jcza/axure-to-frontend.git "$env:USERPROFILE\.codex\skills\axure-to-frontend"
```

安装后重启 Codex 或重新加载会话，让 skill 生效。

### 使用方式

在请求中明确提到该 skill：

```text
[$axure-to-frontend](path/to/SKILL.md) 将 Axure 原型目录还原为前端项目。
```

Codex 会询问必要选项，例如：

- 入口页面。
- 前端技术栈。
- 原型类型。
- 输出目录。
- 还原深度。
- 路由/状态合并策略。
- 响应式目标。

### 还原深度

分析完成后，skill 会让用户选择还原深度：

- **静态可见页面还原**：只还原用户选择的可见页面或状态。速度更快，不实现隐藏面板、事件、交互、条件或流程。
- **完整原型还原**：还原可见 UI，并进一步实现交互、动态面板、隐藏状态、中继器、表格、条件、弹窗和页面流程。

### 核心解析原则

该 skill 最重要的规则是：对每个优先页面执行 Axure 的 `files/<page>/data.js`，在受控本地 JavaScript 环境中捕获传给 `$axure.loadCurrentPage` 的对象，并递归抽取真实 widget 图。

这样可以避免靠肉眼阅读压缩后的 `data.js` 或只用关键词搜索猜结构，并能把隐藏动态面板、中继器模板、表格单元格、复选框和按钮文字作为正式还原对象。

同时，Axure 的元件类型不是前端组件的一一映射。skill 会根据重复布局、页面跳转、事件脚本、选中状态、标签文字和控件组合，先推断产品语义，再映射为前端组件。例如：多页复制的菜单会被识别为共享应用外壳，带点击事件的 label/矩形会被识别为按钮或菜单项，标签+输入框+下拉框会被识别为表单或筛选工具栏，上传提示区会被识别为上传组件。

但语义推断不能覆盖 Axure 已经明确给出的证据。菜单、标签、按钮、tooltip/title 等可见文字必须按当前页面原文、数量、顺序和选中状态还原；`textBox`、`checkbox`、`radioButton`、`comboBox` 等直接控件必须保持为可操作的前端控件；边框、矩形、分组和容器层级必须来自 Axure CSS/SVG/对象树，不能因为使用组件库而新增原型中不存在的内框或卡片。

还原时必须同时建立代码结构账本、样式账本和数据/文本账本：组件类型要映射正确，例如 Axure 日期输入框组合应还原为可用 DatePicker；样式要从 CSS/SVG 状态中复刻，例如复选框颜色、边框和间距；交互后内容要从隐藏面板原始 HTML/data 中提取，例如会议邀请面板的真实三列数据和按钮位置。

### 校验

如本地有 Codex skill 校验脚本，可运行：

```bash
python path/to/skill-creator/scripts/quick_validate.py ~/.codex/skills/axure-to-frontend
```

生成前端项目后的校验，请按生成项目中的 README 执行构建、类型检查和浏览器截图检查。

---

## English

`axure-to-frontend` is a Codex skill for converting Axure RP 11 exported HTML prototype directories into responsive TypeScript frontend projects.

This repository contains only the `axure-to-frontend` skill package. It does not include sample prototypes, generated frontend projects, or unrelated application code.

### What This Skill Does

The skill guides Codex through analyzing an Axure export and generating a frontend project according to the restoration depth selected by the user. It supports:

- React/Vue + Vite + TypeScript project generation.
- Ant Design, Element Plus, or Ant Design Vue component mapping.
- Responsive adaptive restoration instead of fixed Axure pixel copying.
- Executable Axure `data.js` extraction for dynamic panels, repeaters, tables, checkboxes, buttons, and interaction targets.
- A choice between static visible-page restoration and full prototype restoration after analysis.
- Route/state consolidation for Axure pages that represent UI states, such as expanded side menus.
- Semantic inference for non-standard Axure compositions, including copied menus, label-based buttons, form/toolbar clusters, upload areas, dialogs, and hidden panels.
- Mandatory code-structure, style, and data/text fidelity ledgers so restoration is not based on screenshot-level visual guessing alone.
- Evidence-locked content, control, and style-structure gates before semantic inference, preventing menu label rewrites, input-to-label regressions, and invented checkbox wrappers.

### Skill Structure

```text
axure-to-frontend/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── axure-analysis.md
│   ├── axure-official-capabilities.md
│   └── frontend-mapping.md
└── scripts/
    └── inspect_axure_export.py
```

### Installation

Clone this repository into your Codex skills directory:

```bash
git clone https://github.com/tianyi092-jcza/axure-to-frontend.git ~/.codex/skills/axure-to-frontend
```

On Windows, the default Codex skills directory is usually:

```powershell
git clone https://github.com/tianyi092-jcza/axure-to-frontend.git "$env:USERPROFILE\.codex\skills\axure-to-frontend"
```

Restart Codex or reload the session so the skill becomes discoverable.

### Usage

Mention the skill when asking Codex to restore an Axure export:

```text
[$axure-to-frontend](path/to/SKILL.md) Restore this Axure prototype directory as a frontend project.
```

Codex will ask for required choices such as:

- Entry page.
- Frontend stack.
- Prototype type.
- Output directory.
- Restoration depth.
- Route/state strategy.
- Responsive target.

### Restoration Depths

After analysis, the skill asks which restoration depth to use:

- **Static visible-page restoration**: restore only the selected visible pages or states. This is faster and does not implement hidden panels, events, interactions, conditions, or flows.
- **Full prototype restoration**: restore visible UI plus interactions, dynamic panels, hidden states, repeaters, tables, conditions, dialogs, and page flows.

### Core Parsing Principle

The most important implementation rule is to execute each priority page's Axure `files/<page>/data.js` in a controlled local JavaScript environment, capture the object passed to `$axure.loadCurrentPage`, and recursively extract the real widget graph.

This avoids guessing from compressed `data.js` text or keyword search alone, and makes hidden dynamic panels, repeater templates, table cells, checkboxes, and button labels first-class restoration targets.

Axure widget types are not one-to-one frontend components. The skill first infers product semantics from repeated layout, page jumps, event scripts, selected states, visible labels, and control clusters, then maps those semantics to frontend components. For example, copied menus across pages become a shared app shell, clickable labels/rectangles become buttons or menu items, label+input+select clusters become forms or filter toolbars, and upload prompt regions become upload components.

Semantic inference is constrained by source evidence. Visible menu, tab, label, button, tooltip, and title text must preserve the current page's exact wording, count, order, and selected state. Direct Axure controls such as `textBox`, `checkbox`, `radioButton`, and `comboBox` must remain operable frontend controls. Borders, rectangles, groups, and wrapper hierarchy must come from Axure CSS/SVG/object data; the generated frontend must not invent extra inner frames or cards around library controls.

Restoration must maintain code, style, and data/text ledgers together: component type must be correct, such as mapping an Axure date-input composite to an operable DatePicker; styles must be copied from CSS/SVG state evidence, such as checkbox color, border, and spacing; post-action content must be extracted from hidden panel HTML/data, such as exact meeting invitation columns and action placement.

### Validation

For basic skill validation, run the Codex skill validation script if available:

```bash
python path/to/skill-creator/scripts/quick_validate.py ~/.codex/skills/axure-to-frontend
```

For frontend output validation, follow the generated project README and run the project's build/typecheck plus browser screenshot checks.
