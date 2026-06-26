# Orchestration And Tasking

Use this reference when an Axure export has many pages, repeated chrome, many hidden states, or enough widgets that a one-pass implementation would be fragile.

## Responsibility Split

`axure-to-frontend` is the domain expert and acceptance authority:

- ask user choices;
- extract Axure evidence;
- build ledgers;
- infer components and interactions;
- define tasks and validation criteria.

The superpowers process is the execution engine:

- expand ledgers into granular tasks;
- execute tasks in dependency order;
- verify each task;
- iterate when validation fails.

Do not let implementation start as an unstructured coding pass. Implementation should consume task items generated from evidence.

Superpowers must run behind explicit hooks. The user must be able to stop after evidence, inspect generated tasks, choose which tasks to execute, and decide whether validation runs.

## Phase Outputs

### 1. Decision Phase

Produce a short decision record:

- export directory;
- entry page;
- stack;
- prototype type;
- target theme: light or dark;
- output directory;
- restoration depth;
- route strategy;
- state consolidation policy;
- responsive target;
- data handling;
- implementation order.

### 2. Evidence Phase

Produce analysis artifacts before coding:

- `axure-analysis.json`: first-pass export scan;
- `page-inventory.json`: page list, HTML/data/style paths, assets, feature counts;
- `route-graph.json` or Mermaid: linkWindow and linkFrame actions, candidate frontend routes, and inline-frame target pages;
- `shared-chrome-ledger.json`: repeated header/sidebar/menu/tabs/shell, including rail bounds, slot bounds/order, copied group ids, link targets, selected-state evidence, and icon-role evidence;
- `inline-frame-ledger.json` when applicable: frame widget ids, default embedded page, frame bounds, target object ids, source widgets with linkFrame, and embedded component/route mapping;
- `state-variant-ledger.json`: pages that are likely UI states rather than routes;
- `asset-ledger.json`: product/content assets, generic icons, missing references.
- `visual-baseline-ledger.json` or per-page visual baseline notes: reference viewport screenshots, user-selected target theme, source color/contrast notes, app shell, major regions, dominant assets, initial visibility, and scroll model.
- `element-coverage-ledger.json`: every extractor `mustImplement` widget by page/state, including scriptId, type, bounds, text/input/options, asset refs, initial visibility, hidden ancestor state, interaction keys, and implementation disposition.
- `interaction-contract-ledger.json`: every event-bearing source widget with trigger, action sequence, target widgets/routes, inferred intent, and required validation behavior.
- `superpower-workflow.json`: hook state, task manifest, task counts, evidence artifact paths, and approval placeholders.

For each selected page/state, produce:

- `code-ledger`: ids, scriptIds, types, labels, parent paths, visibility, interaction targets;
- `layout-ledger`: bounds, rows, columns, groups, repeated item geometry, scroll regions;
- `style-ledger`: CSS selectors, colors, fills, borders, radius, opacity, typography, states;
- `data-ledger`: exact text, defaults, options, rows, URLs, dates, passwords, action labels;
- `component-map`: Axure evidence -> semantic role -> frontend component/fallback;
- `interaction-map`: source event -> action sequence -> target widget/state/route.

### 3. Tasking Phase

Stop at `SP-HOOK-01 tasking` before task generation or refresh:

- Show the evidence artifact list.
- Show page count, mustImplement count, interaction source count, hidden target count, repeated chrome count, and known high-risk interaction categories.
- Ask the user whether to generate/refresh the superpowers task plan.
- Record the answer in the workflow audit trail. If the user says no, stop before implementation.

Generate `task-plan.md` from the evidence. Use small, dependency-aware tasks:

1. Project initialization and build wiring.
2. Visual baseline, selected theme tokens, and source contrast notes.
3. Shared app shell and route outlet, including repeated sidebar/topbar consolidation.
4. Shared assets and dominant visual assets.
5. Shared component primitives proven by multiple pages.
6. Page visual skeleton restoration, one page/state at a time.
7. Page element coverage reconciliation against `mustImplement` rows.
8. Page visible control/data restoration.
9. Page component mapping fixes.
10. Hidden panels/dialogs/drawers/popovers.
11. Repeater/table data and templates.
12. Page-internal interactions.
13. Cross-page navigation.
14. Responsive/scroll-model validation.
15. README and validation report.

After task generation, stop at `SP-HOOK-02 execution`:

- Show the task ids, titles, dependencies, evidence files, and acceptance checks.
- Ask whether to execute all tasks, selected task ids, or stop for review.
- If selected task ids are requested, execute only those and leave the rest pending.
- Record the answer in the workflow audit trail.

For very large prototypes, create milestones:

- Milestone 0: evidence extraction and task plan only.
- Milestone 1: shared shell plus one representative page.
- Milestone 2: remaining static visible pages.
- Milestone 3: high-value interactions and hidden states.
- Milestone 4: complete flow validation and documentation.

## Task Item Schema

Each task should have this shape:

```markdown
### AX-<number> <short title>

- Source: <page/state/interaction>
- Evidence: <ledger files and row ids>
- Depends on: <task ids>
- Scope: <exact widgets/regions/actions>
- Implementation files: <expected frontend files>
- Acceptance:
  - <content/layout/control/data/interaction assertions>
- Validation:
  - <build/lint/browser screenshot/click path>
- Notes:
  - <uncertainty, fallback, or allowed deviation>
```

Acceptance must be specific enough that another agent can verify it without reading the entire conversation.

The generated task manifest must also include a machine-readable copy of each task in `superpower-workflow.json` so the user can inspect task coverage without parsing markdown.

## Granularity Rules

- Split shared shell from page content.
- Split visual skeleton from semantic component rendering.
- Split visible state from hidden state.
- Split data extraction from component rendering.
- Split table/repeater dataset from row template controls.
- Split modal classification from modal content implementation.
- Split route graph from route implementation.
- Split responsive/scroll validation from initial layout implementation.

If a task mentions more than one page and is not shared infrastructure, it is probably too broad.

## Evidence-To-Task Mapping

Use these mappings:

- One repeated chrome ledger -> shared shell tasks, with acceptance for covered source widgets, visible slot click areas, route navigation, active state, and framework icon replacement.
- One inline-frame ledger -> shell outlet task plus linkFrame interaction task, with acceptance for default embedded content, targeted frame switching, retained shell chrome, and no duplicated feature-page shell.
- One visual baseline ledger -> selected theme tokens, source contrast notes, shell geometry, major-region, dominant-asset, and scroll-model tasks.
- One element coverage ledger -> per-page reconciliation tasks for initially visible widgets, controls, asset widgets, interaction sources, and hidden interaction targets.
- One page visible-state ledger -> static page restoration task.
- One dynamic panel state -> conditional panel, modal, drawer, or popover task.
- One repeater/table -> data extraction task plus template/render task.
- One Axure repeater -> framework List/ListItem task by default; Table/Grid task only when table/grid evidence is present.
- One event source with action sequence -> interaction task.
- One state-variant page group -> state consolidation task.
- One viewport/scroll issue -> responsive shell or local overflow task.

## Execution Loop

For each task:

1. Re-open only the relevant ledger/reference files.
2. Implement the smallest necessary code change.
3. Run the task's validation.
4. Compare against Axure evidence.
5. If validation fails because of a repeatable extraction, asset, layout, visibility, or interaction pattern, update the skill script/reference/renderer asset first and rerun from clean output.
6. Fix generated output directly only for user-approved product-specific customization, never as skill validation evidence.
7. Mark the task complete only when acceptance checks pass.

Do not batch many incomplete pages and defer validation; that recreates the original scale problem.

After task execution, stop at `SP-HOOK-03 validation`:

- Show the validation matrix and exact commands/browser flows that will run.
- Include interaction validation derived from `interaction-contract-ledger.json`, especially close/cancel/confirm controls, hidden panel reveal/hide, linkWindow route links, linkFrame embedded-page switches, repeater row actions, and shared chrome navigation.
- Ask whether to run validation now.
- Record the answer and validation result in the workflow audit trail.

## Validation Matrix

Every page task should check:

- visual skeleton resemblance at the reference viewport;
- user-selected theme, source contrast hierarchy, and framework token alignment;
- major region count, order, placement, and scale;
- exact visible text and action labels;
- visible control count and source control type;
- `mustImplement` coverage disposition with no unexplained missing text, control, asset, or interaction-target rows;
- default values and row data;
- repeater rendering through a framework List/ListItem component unless source evidence proves Table/Grid;
- layout bands, columns, spacing rhythm, and section grouping;
- extra/missing visual containers;
- asset presence;
- body versus local scroll;
- selected/active/disabled state;
- interaction target visibility and content.
- shared chrome pages: one shared sidebar/topbar instance, no leaked duplicated source widgets, distinct non-generic framework icons, canonical collapsed/expanded menu evidence, no slot-index-invented modules, and clickable slots matching source or canonical `linkWindow`/`linkFrame` targets such as the system setting route.
- inline-frame shells: default frame content appears inside the source frame bounds, feature-page clicks update the targeted frame, and embedded content remains interactive without replacing or duplicating the outer shell.

Every interaction task should check:

- source widget;
- event type;
- action order;
- target widget or route;
- target subtree content;
- button labels;
- dialog/inline classification;
- close/cancel/confirm behavior;
- resulting scroll model.

## Failure Handling

When evidence is missing:

- pause only the affected task;
- document the missing source;
- inspect rendered Axure or request user guidance;
- do not invent product data or layout.

When implementation differs from Axure:

- fix it if it violates data, layout, component, or interaction fidelity;
- document it only if the user approved the deviation or the selected framework lacks an exact equivalent.
