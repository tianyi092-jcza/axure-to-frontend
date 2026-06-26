# Prototype Architecture Profiles

Use this reference after the first export scan and before task generation. The architecture profile controls how pages, shared chrome, routes, dynamic panels, and validation tasks are interpreted. Do not guess silently: show the detected profile evidence and ask the user to confirm or override it unless the user requested an automatic full run.

## Profile Selection

Run `scripts/inspect_axure_export.py` first and read its `architecture` section.

- `multi-page-repeated-shell`: multiple independent exported pages repeat the same title/header/sidebar/menu widgets and use `linkWindow` to switch pages.
- `single-shell-inline-frame`: a unique shell page owns the topbar/sidebar/menu and contains an Axure `inlineFrame` whose source is changed by `linkFrame` actions.
- `single-page-dynamic-panel-app`: one app page or a small number of entry pages use a main dynamic panel, nested dynamic panels, and `setPanelState` actions as functional modules.
- `mixed-or-uncertain`: more than one pattern is present or the score gap is small. Ask the user to choose the primary profile and document exceptions.

The selected profile is not informational. It is a task-generation input. Record the confirmed profile in `axure-ledgers/superpower-workflow.json`, `task-plan.md`, `README.md`, and validation notes. If the user confirms or overrides the profile, downstream tasks must follow that profile's navigation and menu strategy.

Always keep shared low-level rules outside the profile: button/group event inheritance, hidden-state scoping, modal geometry, icon replacement, repeater/table extraction, data fidelity, and framework control mapping apply to every profile.

## Multi-Page Repeated Shell

Observed example: `yuanxing1.0`.

Detection evidence:

- Many root HTML pages under the sitemap.
- Feature pages repeat similar title/header/sidebar/menu widgets.
- Menu items use `linkWindow` to other exported pages.
- Several pages share a similar navigation target set.
- No page-level `inlineFrame` is required for the main app shell.

Restoration strategy:

- Build one shared `AppShell` from the repeated chrome evidence, not one copied shell per page.
- Derive the canonical menu from event-bearing groups/buttons, descendant text, icons, y-order, selected states, and `linkWindow` targets across all repeated pages.
- Merge repeated menu evidence by target route and label. If one page has the label and another page has the route or selected state, combine them into one canonical item.
- Implement feature pages as frontend routes inside the shared shell.
- Preserve page-specific hidden dialogs, repeaters, forms, and events inside their route components.
- Validate each canonical menu item by clicking the visible label/icon/button target, not only the invisible parent group.

Blocking failures:

- Rendering duplicated sidebars/topbars inside every route.
- Inventing menu modules from slot index when labels or event targets are unresolved.
- Dropping a module because only one repeated page exposes its event or text.

## Single Shell Inline Frame

Observed example: `yuanxing2.0`.

Detection evidence:

- One shell page has a visible app chrome and an `inlineFrame`/iframe widget.
- Shell menu/button events include `linkFrame` actions.
- Frame targets are exported prototype pages such as feature pages.
- Feature pages should not own the global topbar/sidebar.

Restoration strategy:

- Treat the shell page as the frontend entry route.
- Treat the inline frame as an embedded route outlet/component container, not as an external iframe when the target is an exported page.
- Implement `linkFrame` by changing only the targeted frame content state. Do not convert it into a whole-browser route unless the source action is `linkWindow`.
- Preserve the shell's frame bounds and default target page.
- Feature pages render only functional content inside the outlet; duplicated feature-page chrome is suppressed unless the source target page genuinely contains local chrome.
- Validate every `linkFrame` source against the target frame id and target page.

Blocking failures:

- Menu click only changes selected styling and does not switch frame content.
- Feature page content is rendered behind or outside the shell frame bounds.
- The same shell chrome appears both outside and inside the frame.
- A visible child label/icon of a shell button does not proxy the parent `linkFrame` click.

## Single Page Dynamic Panel App

Observed example: `yuanxing-kj` uses top-level login/register/home pages plus large home pages whose functional modules are driven by dynamic panels such as `main`, `侧边栏`, and nested personal-center panels.

Detection evidence:

- No main `inlineFrame`.
- High dynamic panel and `setPanelState` counts.
- Events mention actions such as `设置 main to ...`, `设置 侧边栏 to ...`, or nested panel state changes.
- The sitemap may still contain entry pages such as login/register/company/government home. Treat those as top-level routes around the dynamic-panel app, not as evidence against the profile.

Restoration strategy:

- Keep the page containing the main menu and main dynamic panel as a single app route.
- Model the main dynamic panel as local typed state or nested route state according to user preference, but preserve Axure behavior first.
- Map menu clicks to `setPanelState` transitions. Do not replace them with `linkWindow` unless the Axure action is actually `linkWindow`.
- Build a dynamic-panel navigation ledger before implementation. For every menu/button/tab candidate, capture source id/scriptId, visible child label/icon ids, trigger event, target panel id/scriptId, target state name/index, selected-state side effects, and whether the clickable source is hidden/zero-size.
- Transfer events from invisible parent groups to the visible menu label/icon/button bounds. The visible menu item must be clickable even when Axure stored the event on a transparent group.
- Implement a panel-state state machine for the main dynamic panel. The restored state key must come from Axure state names/ids, not invented route names.
- Render only the active/default panel state initially. Inactive state descendants must be available for later state transitions but must not leak into the initial layout.
- Preserve nested dynamic panel state independently. A parent panel switch must not accidentally reveal all child states.
- Show/hide actions on side menus, feedback panels, personal-center panels, dialogs, and popovers remain show/hide behavior.
- Validate primary menu items, submenu expand/collapse, panel-state switches, and nested panel-state switches.

Blocking failures:

- Treating every panel state as a separate visible page at load time.
- Losing `setPanelState` events on menu buttons or child labels/icons.
- Converting panel state switches into unrelated browser routes.
- Rendering inactive panel-state content as normal page content.
- Treating the dynamic-panel menu as repeated route chrome or inline-frame navigation.
- Generating menu items without a source `setPanelState` contract and then leaving clicks unimplemented.

## Mixed Exports

Some exports combine patterns: login/register pages may use `linkWindow`, a home page may use dynamic panels, and a feature shell may use inline frames. In that case:

- Pick one primary app profile for the main authenticated/product area.
- Treat login/register/start pages as entry routes.
- Treat exceptional pages with their own local profile only when the evidence requires it.
- Record the selected primary profile and exceptions in `axure-ledgers/superpower-workflow.json`, `task-plan.md`, and `README.md`.
