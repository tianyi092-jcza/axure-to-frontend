# axure-to-frontend

Codex skill for converting Axure RP 11 exported HTML prototype directories into responsive TypeScript frontend projects.

This repository contains only the `axure-to-frontend` skill package.

## What This Skill Does

`axure-to-frontend` guides Codex through analyzing an Axure export and restoring it as a frontend project, with support for:

- React/Vue + Vite + TypeScript project generation.
- Ant Design, Element Plus, or Ant Design Vue component mapping.
- Responsive adaptive page restoration instead of fixed Axure pixel copying.
- Executable Axure `data.js` extraction for dynamic panels, repeaters, tables, checkboxes, buttons, and interaction targets.
- Static visible-page restoration or full prototype restoration, selected after analysis.
- Route/state consolidation for Axure pages that represent shell states, such as expanded side menus.

## Skill Structure

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

## Installation

Clone this repository into your Codex skills directory:

```bash
git clone https://github.com/tianyi092-jcza/axure-to-frontend.git ~/.codex/skills/axure-to-frontend
```

On Windows, the default Codex skills directory is usually:

```powershell
git clone https://github.com/tianyi092-jcza/axure-to-frontend.git "$env:USERPROFILE\.codex\skills\axure-to-frontend"
```

Restart Codex or reload the session so the skill is discoverable.

## Usage

Mention the skill when asking Codex to restore an Axure export:

```text
[$axure-to-frontend](path/to/SKILL.md) 将 Axure 原型目录还原为前端项目。
```

Codex will ask for required choices such as:

- Entry page.
- Frontend stack.
- Prototype type.
- Output directory.
- Restoration depth.
- Route/state strategy.
- Responsive target.

## Restoration Depths

After analysis, the skill asks which restoration depth to use:

- **Static visible-page restoration**: only restore selected visible pages/states. This is faster and does not implement hidden panels, events, interactions, conditions, or flows.
- **Full prototype restoration**: restore visible UI plus interactions, dynamic panels, hidden states, repeaters, tables, conditions, dialogs, and page flows.

## Core Parsing Principle

The most important implementation rule is to execute each priority page's Axure `files/<page>/data.js` in a controlled local JavaScript environment, capture the object passed to `$axure.loadCurrentPage`, and recursively extract the widget graph.

This avoids guessing from compressed `data.js` text and makes hidden dynamic panels, repeater templates, table cells, checkboxes, and button labels first-class restoration targets.

## Validation

For basic skill validation, run the Codex skill validation script if available:

```bash
python path/to/skill-creator/scripts/quick_validate.py ~/.codex/skills/axure-to-frontend
```

For frontend output validation, follow the generated project README and run the project's build/typecheck plus browser screenshot checks.
