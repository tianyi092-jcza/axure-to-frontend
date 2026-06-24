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

## Phase Outputs

### 1. Decision Phase

Produce a short decision record:

- export directory;
- entry page;
- stack;
- prototype type;
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
- `route-graph.json` or Mermaid: linkWindow actions and candidate frontend routes;
- `shared-chrome-ledger.json`: repeated header/sidebar/menu/tabs/shell;
- `state-variant-ledger.json`: pages that are likely UI states rather than routes;
- `asset-ledger.json`: product/content assets, generic icons, missing references.

For each selected page/state, produce:

- `code-ledger`: ids, scriptIds, types, labels, parent paths, visibility, interaction targets;
- `layout-ledger`: bounds, rows, columns, groups, repeated item geometry, scroll regions;
- `style-ledger`: CSS selectors, colors, fills, borders, radius, opacity, typography, states;
- `data-ledger`: exact text, defaults, options, rows, URLs, dates, passwords, action labels;
- `component-map`: Axure evidence -> semantic role -> frontend component/fallback;
- `interaction-map`: source event -> action sequence -> target widget/state/route.

### 3. Tasking Phase

Generate `task-plan.md` from the evidence. Use small, dependency-aware tasks:

1. Project initialization and build wiring.
2. Shared app shell and route outlet.
3. Shared assets and theme tokens.
4. Shared component primitives proven by multiple pages.
5. Page visible state restoration, one page at a time.
6. Page component mapping fixes.
7. Hidden panels/dialogs/drawers/popovers.
8. Repeater/table data and templates.
9. Page-internal interactions.
10. Cross-page navigation.
11. Responsive/scroll-model validation.
12. README and validation report.

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

## Granularity Rules

- Split shared shell from page content.
- Split visible state from hidden state.
- Split data extraction from component rendering.
- Split table/repeater dataset from row template controls.
- Split modal classification from modal content implementation.
- Split route graph from route implementation.
- Split responsive/scroll validation from initial layout implementation.

If a task mentions more than one page and is not shared infrastructure, it is probably too broad.

## Evidence-To-Task Mapping

Use these mappings:

- One repeated chrome ledger -> shared shell tasks.
- One page visible-state ledger -> static page restoration task.
- One dynamic panel state -> conditional panel, modal, drawer, or popover task.
- One repeater/table -> data extraction task plus template/render task.
- One event source with action sequence -> interaction task.
- One state-variant page group -> state consolidation task.
- One viewport/scroll issue -> responsive shell or local overflow task.

## Execution Loop

For each task:

1. Re-open only the relevant ledger/reference files.
2. Implement the smallest necessary code change.
3. Run the task's validation.
4. Compare against Axure evidence.
5. Fix immediately if validation fails.
6. Mark the task complete only when acceptance checks pass.

Do not batch many incomplete pages and defer validation; that recreates the original scale problem.

## Validation Matrix

Every page task should check:

- exact visible text and action labels;
- visible control count and source control type;
- default values and row data;
- layout bands, columns, spacing rhythm, and section grouping;
- extra/missing visual containers;
- asset presence;
- body versus local scroll;
- selected/active/disabled state;
- interaction target visibility and content.

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

