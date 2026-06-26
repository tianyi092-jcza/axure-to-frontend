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
3. Prototype architecture profile detection and user confirmation.
4. Fidelity ledgers and evidence gates.
5. Component and interaction interpretation.
6. Detailed task decomposition for large prototypes.
7. Validation standards and acceptance reporting.

When validating or improving this skill, do not treat hand-fixed frontend output as proof that the skill works. A successful validation must come from a clean conversion run that follows this skill from source evidence to implementation without page-specific corrective patches from prior feedback.

Use a superpowers-style process skill for the execution loop after analysis: create granular tasks, implement task-by-task, verify each task, and iterate from evidence. If no superpowers or `using-superpowers` process skill is available in the current session, stop before conversion planning and ask the user to install or enable it.

The superpowers handoff is auditable and must use explicit user-visible hooks. Do not silently roll task generation, task execution, and validation into one continuous run.

## Skill Size Rule

Keep this `SKILL.md` as the compact entrypoint. Do not add long component tables, Axure capability catalogs, examples, or page-specific lessons here. Put detailed rules in `references/`, deterministic extraction in `scripts/`, and reusable output scaffolds in `assets/` only when needed.

## Operating Model

Follow this contract for every conversion:

1. **Decision phase**: ask only the required user choices that affect architecture, scope, restoration depth, output, and validation.
2. **Evidence phase**: inspect Axure files, execute page data scripts, and capture the rendered visual baseline. Produce source-derived ledgers before coding.
3. **Architecture hook**: show the detected prototype architecture profile, profile scope, page roles, evidence, confidence, and ask the user to confirm or override it. Stop until the user answers unless the user requested an automatic full run. Record the confirmed profile and make it drive every downstream task; do not let task generation silently fall back to a generic route/menu strategy.
4. **Tasking hook**: show the evidence summary, generated ledger locations, interaction-contract count, and ask whether to let the superpowers process generate/refresh the task plan. Stop until the user answers.
5. **Tasking phase**: use the superpowers process to turn ledgers into a detailed task plan with dependencies and acceptance checks. Produce a task manifest the user can inspect.
6. **Execution hook**: show the task manifest and ask whether to execute all tasks, selected tasks, or stop for review. Stop until the user answers.
7. **Execution phase**: implement in small batches from the task plan. Do not skip ledger rows or invent data/layout.
8. **Validation hook**: show the validation plan and ask whether to run validation. Stop until the user answers.
9. **Validation phase**: compare rendered Axure and frontend states, run build/typecheck/lint, test interactions, and record deviations.
10. **Delivery phase**: produce the frontend project plus README, route map, component map, interaction notes, and validation report.

Core restoration priority is fixed for this skill: framework colors/styles may follow the selected frontend library, but source layout, prototype data, events/page interactions, and framework-icon replacement are blocking requirements. Do not accept a run when data is missing, a modal/popover/drawer uses stale Axure page coordinates instead of exported fixed/overlay positioning, interaction targets are unreachable, or generic SVG icons become blank/placeholder blocks.

When an Axure export uses a single shell page with an `inlineFrame` to switch feature pages, treat the shell as the frontend entry page and the frame as an embedded route outlet. Recover `linkFrame` actions with both the target page and target frame object id; a `linkFrame` menu/button click is an interaction contract, not a decorative selection effect.

When an Axure export uses a single page or main page with dynamic panels to switch functional modules, treat the main dynamic panel as local frontend state. Recover menu/button `setPanelState` actions with source widget ids, visible child label/icon click targets, target panel ids, and target state names. A menu click that only changes selected styling or does nothing is an interaction failure.

Architecture profiles are scoped to the pages that carry that structure. Do not apply the detected profile blindly to the whole export directory. A second-structure export may have one main shell page with an inline frame plus unrelated login, registration, welcome, guide, or standalone pages. A third-structure export may have a dynamic-panel main app page plus independent entry pages. The evidence and task plan must classify page roles first, then apply the confirmed profile only to its main app pages and explicitly list exceptions.

For large prototypes, never try to restore everything in one pass. Process shared chrome first, then pages in dependency order, then hidden states/interactions, then cross-page flows.

## Required Resource Loading

Load only the references needed for the current phase:

- Analysis and ledgers: `references/axure-analysis.md`
- Prototype architecture/profile selection: `references/prototype-architecture-profiles.md`
- Visual/layout restoration gate: `references/visual-restoration.md`
- Axure capability coverage: `references/axure-official-capabilities.md`
- Framework/component mapping: `references/frontend-mapping.md`
- Large-prototype orchestration and task decomposition: `references/orchestration-and-tasking.md`

Prefer scripts for repeatable extraction:

- First-pass export scan:

```bash
python <skill-dir>/scripts/inspect_axure_export.py <axure-export-dir> --out axure-analysis.json
```

Read `axure-analysis.json.architecture` after this scan. Show the candidate profiles, `scope`, and `page_roles`, then ask the user to confirm the structure profile and any page-role exceptions before task generation.

- Code-level page extraction:

```bash
node <skill-dir>/scripts/extract_axure_page_data.js <axure-export-dir> <page-key> --out <output-json>
```

`page-key` is the folder name under `files/`, such as `create-meeting`, `meeting-setup`, or `glossary`.

For React + Ant Design restoration runs, prefer the bundled renderer scaffold instead of ad hoc page code:

```bash
node <skill-dir>/scripts/install_react_antd_renderer_assets.mjs <output-project-dir>
node <skill-dir>/scripts/generate_axure_evidence.mjs <output-project-dir> <axure-export-dir> <target-theme> <viewport>
```

After `generate_axure_evidence.mjs`, stop at `SP-HOOK-01 tasking`. Show `axure-ledgers/superpower-workflow.json`, `task-plan.md`, and the interaction contract summary, then ask the user whether to run the superpowers tasking/execution workflow. Only after explicit approval continue to:

```bash
node <skill-dir>/scripts/build_react_antd_axure_data.mjs <output-project-dir> <axure-export-dir>
```

The renderer scaffold in `assets/react-antd-renderer/` is intentionally generic. If validation exposes a repeatable restoration gap, update the skill scripts/assets first, then rerun from a clean output directory.

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
5. Target theme: light or dark. Do not infer the target theme from the Axure export. Use Axure colors only as source evidence for contrast, hierarchy, and mixed-surface warnings.
6. Output location.

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
2. Architecture scope ledger: primary profile, confidence, page roles, main app pages, inline-frame target pages, dynamic-panel app pages, repeated-shell pages, entry/standalone pages, and exception pages that must not inherit the main app profile.
3. Route graph from sitemap and `linkWindow` actions.
4. Shared chrome inventory: topbar, sidebar, menu labels, icons, selected states, collapse/expand variants, slot geometry, zero-size/transparent interaction groups, and link targets.
5. Inline-frame inventory when present: frame widget ids, default target page, frame bounds, target object ids, `linkFrame` sources, and embedded page route/component mapping.
6. Dynamic-panel app inventory when present: main panel candidates, menu/source widgets, visible child label/icon proxy targets, `setPanelState` actions, target panel ids, target state names, default state, nested panel states, and validation click flows.
7. For every selected page/state:
   - Visual baseline ledger: rendered screenshot viewport, user-selected target theme, source color/contrast notes, app shell, major regions, dominant assets, initial visibility, and scroll model.
   - Code structure ledger: ids, scriptIds, Axure types, parent paths, visibility, events, target widgets.
   - Layout ledger: panel bounds, columns, rows, repeated item geometry, y-order, scroll model.
   - Style ledger: CSS selectors, colors, borders, fills, radius, fonts, opacity, state styles.
   - Data ledger: exact visible text, default values, options, rows, URLs, dates, passwords, labels, action text.
   - Element coverage ledger: every selected page's `mustImplement` widgets from the extractor, including `scriptId`, type, text/input value, asset refs, bounds, initial visibility, hidden ancestor state, and interaction flags.
   - Component map: Axure evidence -> semantic role -> frontend component -> fallback.
   - Interaction map: event source -> action sequence -> target state/panel/route -> validation state.

Do not start coding a page until its visible state ledger, element coverage ledger, and required component map exist. For full restoration, do not implement an interaction until the target subtree has been extracted.

## Non-Negotiable Fidelity Rules

1. Data fidelity comes first. Use prototype data exactly; do not invent or normalize text, rows, labels, dates, URLs, passwords, or button wording.
2. Visual/layout fidelity comes second and is blocking. Preserve the rendered page's app shell, major region topology, dominant assets, visible count, hierarchy, columns, bands, alignment, density, grouping, user-selected target theme, source contrast hierarchy, and scroll model. Use Axure coordinates as topology evidence, not as mandatory fixed CSS.
3. Component fidelity comes third. Map direct controls directly; infer composites only from type, HTML, styles, neighboring widgets, and events. A faithful child-element reconstruction is better than a wrong high-level component.
4. Interaction fidelity comes fourth. Implement events from Axure action sequences and target widgets. Do not convert a `show/hide` panel action into route navigation.
5. Cross-page flow comes last. Shared shell and current-page fidelity must be stable before broad navigation is added.
6. State scopes must not leak. Hidden dialog/drawer/popover children and inactive panel-state children must not appear in the parent page layout.
7. Modal-like hidden dynamic panels must map to framework Modal/Dialog/Drawer/Popover when structure supports it.
8. Repeater extraction must treat Axure `repeater/中继器` as a data-driven frontend List/ListItem pattern by default, preserving rows and item-template controls; upgrade to Table only when headers, aligned columns, row/column semantics, or source evidence supports it. Always inspect the repeater properties before mapping: when Axure's wrap/grid option is enabled, shown in export data as `repeaterPropMap` with `wrap > 1` and horizontal flow, restore it as the selected framework's grid-list/list-grid component semantics while preserving item width, height, spacing, row count, and item-template controls. Do not mechanically restore repeaters as loose labels, single vertical lists, or tables without evidence.
9. Framework defaults are not sufficient if they change prototype structure. Remove extra borders, wrappers, helper rows, button text spacing, or library colors that have no Axure evidence.
10. Do not redesign or "productize" the page unless the user explicitly asks for redesign. A generic dashboard layout is not an acceptable substitute for an Axure restoration.
11. Ask the user to choose light or dark target theme before conversion. Do not silently choose the theme from Axure source. Exact colors may follow the selected frontend framework, but surface hierarchy, contrast relationships, and mixed dark/light regions from the source must remain recognizable or be documented as user-approved deviations.
12. Every selected page must pass element coverage reconciliation: all `mustImplement` widgets from the extractor are implemented, intentionally mapped to a parent component, or documented as an approved omission. Missing text, inputs, assets, controls, or interaction targets are blocking failures.
13. Validate rendered Axure and frontend at the same viewport before accepting a page or interaction state.
14. Exported CSS positioning is source evidence. If Axure uses `position: fixed`, `left: 50%`, `top: 50%`, margins, pin-to-browser, lightbox, or bring-to-front behavior, the restored panel must keep that overlay geometry/z-order instead of using stale canvas coordinates.
15. Generic UI SVG/vector assets should become selected framework icons when their role can be inferred. A white/gray/blank placeholder block is a failed icon restoration, not an acceptable fallback.
16. Repeated icon-only sidebars must be restored as shared chrome. Extract menu identity from event-bearing groups, descendant text in expanded/collapsed variants, slot y-order, selected states, and `linkWindow` targets. If a collapsed slot only has selected-state actions but an expanded matching slot has the real label or route, merge that canonical evidence back into the collapsed shared item. Do not invent modules from slot index fallback; unresolved slots must be flagged in ledgers instead of silently rendered as fake `team`, `video`, or generic items.
17. Visibility actions must use action description/targets to distinguish show from hide; Axure display names such as `显示/隐藏` are not behavior direction. SVG icon buttons that hide a panel are close controls, and nested panels inside fixed dialogs inherit the fixed ancestor's coordinate system.
18. Axure `button` widgets exported as `div.ax_default.button` must still be treated as buttons. Parse events from widget data, not native HTML tag names.
19. `linkFrame` must be implemented for prototype-page frames. If clicking a menu/button should switch the content of an inline frame, preserving only selected-state styling or whole-page routing is an interaction failure.
20. Direct Axure form/control widgets must restore to the selected frontend framework's corresponding components, not static lookalikes. `radioButton`, `checkbox`, `textBox`, `comboBox`, buttons, date/time inputs, and repeater-template controls must remain operable framework controls with local state and Axure events wired through. When Axure controls have option-group evidence such as an input `name`, group name, selection group, or grouped selected-state actions, restore the corresponding frontend group constraint (`Radio.Group`, checkbox group, segmented control, tabs, or controlled button group) instead of independent controls.

## Component Interpretation Summary

Use `references/frontend-mapping.md` for the detailed table. Core rules:

- `checkbox`, `radioButton`, `textBox`, `comboBox`, table, and repeater are direct evidence for corresponding frontend controls.
- Text input subtype matters: password, email, number, tel, URL, search, file, date, month, and time should map to specialized framework controls when supported.
- Labels, rectangles, images, shapes, and groups with `interactionMap` are interactive candidates. Parse events before deciding Button, Link, MenuItem, Tab, Upload trigger, row action, close control, or state toggle.
- Axure primitives often compose real frontend structures: menus, forms, toolbars, filters, uploaders, tabs, dialogs, cards, and shell layouts.
- If uncertain after checking source code, CSS, HTML, rendered behavior, and events, reconstruct the visible child elements faithfully and document the fallback.

## Superpowers Task Handoff

After evidence is ready, use the superpowers process to create and follow a detailed checklist. The checklist must be generated from ledgers, not from visual guesses.

Use these explicit hooks:

1. `SP-HOOK-01 tasking`: before superpowers task generation, show evidence artifacts and ask whether to generate/refresh the task plan.
2. `SP-HOOK-02 execution`: after task generation, show task ids/titles/evidence/acceptance and ask whether to execute all tasks, selected tasks, or stop.
3. `SP-HOOK-03 validation`: after execution, show validation commands and interaction flows and ask whether to run validation.

Each hook response must be recorded in `axure-ledgers/superpower-workflow.json` or the validation report. If the user asks for an automatic full run, record that as approval for all three hooks.

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
3. Check visual skeleton, selected theme, source contrast hierarchy, dominant assets, content, controls, layout, style structure, data, state scope, dialog classification, element coverage, and scroll model.
4. Trigger primary interactions and validate revealed panels, row actions, dialogs, repeated controls, and generated content.
5. Record intentional deviations in README or validation report. Otherwise fix the implementation.

Static restoration validates visible states only. Full restoration validates visible states plus hidden panels, events, conditions, repeaters, dialogs, and cross-page flows.

## Skill Validation Protocol

Use this protocol when the user is evaluating whether the skill itself can restore an Axure page:

1. Use a clean output directory or clear the requested output before the run.
2. Start from the current `SKILL.md` and required references only; do not reuse a hand-repaired page as the implementation baseline.
3. Generate evidence ledgers and task plan first, then implement from those tasks.
4. Capture frontend screenshots for initial and primary interaction states.
5. Run build/typecheck before visual acceptance. A scaffold or type failure is a skill-rule gap.
6. Compare against the Axure rendered baseline and record failures as skill-rule gaps, not as one-off page bugs.
7. If validation fails, update the skill/rules/scripts, discard the failed output, and rerun from a clean output.
8. Preserve the hook audit trail: `SP-HOOK-01` tasking approval, `SP-HOOK-02` execution approval, and `SP-HOOK-03` validation approval or an explicit user instruction to auto-run them.

Page-specific manual fixes may be useful for diagnosis, but they are invalid as skill acceptance evidence.

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
