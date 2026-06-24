---
name: axure-to-frontend
description: Convert Axure RP 11 exported prototype directories into TypeScript frontend projects. Use when Codex is asked to analyze Axure exports, recover pages, widgets, assets, data, styles, dynamic panels, repeaters, tables, conditions, events, page flows, or interactions, then plan and implement faithful React/Vue frontend restoration with Ant Design, Element Plus, or Ant Design Vue. Also use when improving or validating Axure-to-frontend restoration fidelity, task decomposition, or conversion rules.
---

# Axure To Frontend

## Role

Act first as an Axure expert, then as a frontend restoration orchestrator.

Know Axure's authoring model well enough to make correct conversion choices: pages can be copied state variants, labels can be buttons, dynamic panels can be dialogs, repeaters can be data tables or visual lists, and Axure primitives are not always one-to-one frontend components. Use that Axure understanding to decide what must be analyzed, what must be asked, what can be converted directly, what must be inferred, and what should fall back to faithful child-element reconstruction.

Do not act as a one-shot page generator.

This skill owns:

1. User decisions and scope control.
2. Axure code/style/data extraction.
3. Fidelity ledgers and evidence gates.
4. Component and interaction interpretation.
5. Detailed task decomposition for large prototypes.
6. Validation standards and acceptance reporting.

Use a superpowers-style process skill for the execution loop after analysis: create granular tasks, implement task-by-task, verify each task, and iterate from evidence. If no superpowers or `using-superpowers` process skill is available in the current session, stop before conversion planning and ask the user to install or enable it.

## Skill Size Rule

Keep this `SKILL.md` as the compact entrypoint. Do not add long component tables, Axure capability catalogs, examples, or page-specific lessons here. Put detailed rules in `references/`, deterministic extraction in `scripts/`, and reusable output scaffolds in `assets/` only when needed.

## Operating Model

Follow this contract for every conversion:

1. **Decision phase**: ask only the required user choices that affect architecture, scope, restoration depth, output, and validation.
2. **Evidence phase**: inspect Axure files and execute page data scripts. Produce source-derived ledgers before coding.
3. **Tasking phase**: use the superpowers process to turn ledgers into a detailed task plan with dependencies and acceptance checks.
4. **Execution phase**: implement in small batches from the task plan. Do not skip ledger rows or invent data/layout.
5. **Validation phase**: compare rendered Axure and frontend states, run build/typecheck/lint, test interactions, and record deviations.
6. **Delivery phase**: produce the frontend project plus README, route map, component map, interaction notes, and validation report.

For large prototypes, never try to restore everything in one pass. Process shared chrome first, then pages in dependency order, then hidden states/interactions, then cross-page flows.

## Required Resource Loading

Load only the references needed for the current phase:

- Analysis and ledgers: `references/axure-analysis.md`
- Axure capability coverage: `references/axure-official-capabilities.md`
- Framework/component mapping: `references/frontend-mapping.md`
- Large-prototype orchestration and task decomposition: `references/orchestration-and-tasking.md`

Prefer scripts for repeatable extraction:

- First-pass export scan:

```bash
python <skill-dir>/scripts/inspect_axure_export.py <axure-export-dir> --out axure-analysis.json
```

- Code-level page extraction:

```bash
node <skill-dir>/scripts/extract_axure_page_data.js <axure-export-dir> <page-key> --out <output-json>
```

`page-key` is the folder name under `files/`, such as `create-meeting`, `meeting-setup`, or `glossary`.

## Mandatory User Decision Gates

Do not proceed past a gate by silently choosing defaults unless the user explicitly asks you to decide automatically.

### Before Analysis

Ask for any missing values:

1. Axure export directory.
2. Entry page.
3. Frontend stack:
   - `React + Vite + TypeScript + Ant Design`
   - `Vue 3 + Vite + TypeScript + Element Plus`
   - `Vue 3 + Vite + TypeScript + Ant Design Vue`
4. Prototype type: web or mobile.
5. Output location.

### After Analysis

Show detected pages, route candidates, repeated chrome, state variants, special Axure capabilities, major assets, and data sets. Then ask for:

1. Conversion scope: all pages or selected pages.
2. Route strategy: product routes, edited routes, or Axure-filename-close routes.
3. State consolidation: merge state-variant pages into component state or keep routes.
4. Restoration depth:
   - Static visible-page restoration.
   - Full prototype restoration with events, hidden panels, repeaters, conditions, and flows.
5. Asset exceptions: generic framework icons versus copied product/content assets.
6. Responsive target: desktop/tablet/mobile or explicitly desktop-only.
7. Data handling: local typed prototype data or frontend API/service scaffolding.
8. Implementation order for large prototypes.

## Evidence Model

Before implementation, create source-derived evidence. At minimum:

1. Page inventory from `data/document.js`, root HTML files, and `files/<page>/data.js`.
2. Route graph from sitemap and `linkWindow` actions.
3. Shared chrome inventory: topbar, sidebar, menu labels, icons, selected states, collapse/expand variants, and link targets.
4. For every selected page/state:
   - Code structure ledger: ids, scriptIds, Axure types, parent paths, visibility, events, target widgets.
   - Layout ledger: panel bounds, columns, rows, repeated item geometry, y-order, scroll model.
   - Style ledger: CSS selectors, colors, borders, fills, radius, fonts, opacity, state styles.
   - Data ledger: exact visible text, default values, options, rows, URLs, dates, passwords, labels, action text.
   - Component map: Axure evidence -> semantic role -> frontend component -> fallback.
   - Interaction map: event source -> action sequence -> target state/panel/route -> validation state.

Do not start coding a page until its visible state ledger and required component map exist. For full restoration, do not implement an interaction until the target subtree has been extracted.

## Non-Negotiable Fidelity Rules

1. Data fidelity comes first. Use prototype data exactly; do not invent or normalize text, rows, labels, dates, URLs, passwords, or button wording.
2. Layout fidelity comes second. Preserve visible count, hierarchy, columns, bands, alignment, density, grouping, and scroll model. Use Axure coordinates as topology evidence, not as mandatory fixed CSS.
3. Component fidelity comes third. Map direct controls directly; infer composites only from type, HTML, styles, neighboring widgets, and events. A faithful child-element reconstruction is better than a wrong high-level component.
4. Interaction fidelity comes fourth. Implement events from Axure action sequences and target widgets. Do not convert a `show/hide` panel action into route navigation.
5. Cross-page flow comes last. Shared shell and current-page fidelity must be stable before broad navigation is added.
6. State scopes must not leak. Hidden dialog/drawer/popover children and inactive panel-state children must not appear in the parent page layout.
7. Modal-like hidden dynamic panels must map to framework Modal/Dialog/Drawer/Popover when structure supports it.
8. Repeater/table extraction must include both data rows and item template controls, including checkboxes, radios, avatars, row actions, and status icons.
9. Framework defaults are not sufficient if they change prototype structure. Remove extra borders, wrappers, helper rows, button text spacing, or library colors that have no Axure evidence.
10. Validate rendered Axure and frontend at the same viewport before accepting a page or interaction state.

## Component Interpretation Summary

Use `references/frontend-mapping.md` for the detailed table. Core rules:

- `checkbox`, `radioButton`, `textBox`, `comboBox`, table, and repeater are direct evidence for corresponding frontend controls.
- Text input subtype matters: password, email, number, tel, URL, search, file, date, month, and time should map to specialized framework controls when supported.
- Labels, rectangles, images, shapes, and groups with `interactionMap` are interactive candidates. Parse events before deciding Button, Link, MenuItem, Tab, Upload trigger, row action, close control, or state toggle.
- Axure primitives often compose real frontend structures: menus, forms, toolbars, filters, uploaders, tabs, dialogs, cards, and shell layouts.
- If uncertain after checking source code, CSS, HTML, rendered behavior, and events, reconstruct the visible child elements faithfully and document the fallback.

## Superpowers Task Handoff

After evidence is ready, use the superpowers process to create and follow a detailed checklist. The checklist must be generated from ledgers, not from visual guesses.

Every task should include:

- Task id and title.
- Source page/state/interaction.
- Evidence files and ledger rows.
- Dependencies.
- Implementation files.
- Acceptance checks.
- Validation command or screenshot target.
- Known uncertainty or allowed deviation.

Use `references/orchestration-and-tasking.md` for required task hierarchy and batching rules.

## Validation Requirements

For every implemented page or primary interaction state:

1. Run build/typecheck and lint when available.
2. Capture Axure and frontend screenshots at the agreed viewport when practical.
3. Check content, controls, layout, style structure, data, state scope, dialog classification, and scroll model.
4. Trigger primary interactions and validate revealed panels, row actions, dialogs, repeated controls, and generated content.
5. Record intentional deviations in README or validation report. Otherwise fix the implementation.

Static restoration validates visible states only. Full restoration validates visible states plus hidden panels, events, conditions, repeaters, dialogs, and cross-page flows.

## Required Delivery Artifacts

The generated frontend project must include:

1. The selected frontend stack.
2. Implemented routes/pages/components.
3. Copied assets or documented asset substitutions.
4. Local prototype data or service scaffold according to user choice.
5. `README.md` with stack, source directory, restoration depth, route map, page flow, component mapping notes, interaction notes, asset summary, validation checklist, and known deviations.

For large conversions, also maintain generated analysis artifacts under the project, for example:

- `axure-analysis.json`
- `axure-ledgers/`
- `task-plan.md`
- `validation-report.md`
