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

### Validation

For basic skill validation, run the Codex skill validation script if available:

```bash
python path/to/skill-creator/scripts/quick_validate.py ~/.codex/skills/axure-to-frontend
```

For frontend output validation, follow the generated project README and run the project's build/typecheck plus browser screenshot checks.
