---
name: axure-to-frontend
description: Convert Axure RP 11 exported prototype directories into TypeScript frontend page projects. Use when Codex is asked to analyze an Axure export, identify pages, widgets, assets, event scripts, conditional logic, variables, style states, dynamic panels, repeaters, tables, inline frames, and interactions, then ask required user choices, initialize, and implement a responsive Vue or React project with Ant Design, Element Plus, or Ant Design Vue while preserving prototype data, page flows, and key behavior.
---

# Axure To Frontend

## Overview

Use this skill to turn an Axure 11 HTML export into a typed, responsive frontend implementation. Preserve the prototype's information, interaction intent, script behavior, and page relationships; replace Axure widgets with framework/library components whenever practical.

## Prerequisite

Require the user to have the `obra/superpowers` skill installed before conversion planning. If no superpowers skill is available in the current session, stop before implementation and ask the user to install it from `https://github.com/obra/superpowers`.

## Workflow

1. Ask for the Axure export directory if not supplied.
2. Ask the user to choose all required options in "Mandatory User Decision Gates" below. Do not infer or silently choose a default unless the user explicitly says to decide automatically.
3. Inspect the export directory. Prefer `scripts/inspect_axure_export.py` for a first pass, then execute each priority page's Axure page data script and recursively extract a structured widget inventory as described in "Executable Page Data Extraction" below:

```bash
python <skill-dir>/scripts/inspect_axure_export.py <axure-export-dir> --out axure-analysis.json
```

4. Read `references/axure-official-capabilities.md` to understand the Axure capability surface that must be checked.
5. Read `references/axure-analysis.md` before detailed analysis.
6. Read `references/frontend-mapping.md` before project initialization and implementation.
7. After executable extraction, build a semantic component model as described in "Semantic Component Inference" below. This must happen before route planning or UI implementation.
8. Present a concise analysis summary and ask the user to confirm conversion scope and restoration depth before project initialization.
9. Initialize the selected frontend project in the current working directory unless the user chose another output directory.
10. Use the installed superpowers skill to create a conversion task checklist from the Axure analysis. The checklist must include official capability coverage, page implementation, component mapping, interaction implementation, responsive behavior, and validation tasks.
11. Implement the project pages and code. Generate only the frontend project and page code, plus a `README.md`.
12. Verify the result with local build/typecheck and, when practical, browser screenshots or manual interaction checks.

## Restoration Priority Layers

Restore each requested page in strict layers. Do not move to a lower-priority layer when it would reduce accuracy in a higher-priority layer.

1. Static current-page fidelity comes first: visible widget count, text, asset use, initial visibility, layout relationships, relative proportions, spacing rhythm, color, icon state, panel behavior, and page chrome must match the Axure page before route flow or invented product behavior is added. Axure pixel coordinates and CSS sizes are reference measurements for understanding the current page, not a requirement to hard-code fixed pixel layout.
2. Current-page internal interactions come second: widget events such as showing hidden dynamic panels, toggling a sidebar state, copying text, opening a dialog, or changing local style/state must be implemented on the exact source widget and target region from the Axure behavior model.
3. Cross-page navigation and product flow come third: only implement page jumps after the current page's static and internal behavior are restored. Do not convert an internal Axure `show/hide panel` action into navigation, and do not add extra route buttons because a later page exists.
4. Responsive adaptation is part of fidelity, not a later redesign pass. For desktop-first web prototypes, preserve the Axure desktop composition as the reference at the target viewport, then express it with responsive layout primitives so panels, content areas, and assets adapt within the agreed viewport range.

## Restoration Depth Modes

After analysis, ask the user to choose one restoration depth. The selected depth controls implementation, checklist, README, and validation scope.

1. Static visible-page restoration: implement only the current visible Axure pages/states selected by the user. Accurately restore visible layout, text, assets, controls, chrome, responsive behavior, and page-state screenshots. Do not implement events, conditions, dynamic panel triggers, hidden panels, hover/click behavior, repeaters beyond their visible state, or cross-page flows unless they are visibly present on the selected page. Still inspect the prototype enough to avoid mistaking a state variant for a business page, but document skipped interactions as intentionally out of scope.
2. Full prototype restoration: deeply restore the selected prototype pages including visible pages, hidden dynamic panels, events, interactions, conditions, variables, repeaters, tables, panel states, dialogs, copy prompts, menu expansion, and cross-page flows according to the Axure behavior model.

If the user chooses static visible-page restoration, do not silently add full interactions because they are easy to implement. If the user chooses full prototype restoration, do not stop at screenshot-level matching.

## Responsive Adaptive Fidelity

Use Axure's absolute positions, widths, heights, and generated CSS as measurement evidence, not as implementation commands.

- Derive the layout model from the prototype: fixed chrome versus fluid content, primary columns, proportional widths, minimum usable sizes, alignment anchors, gaps, overflow behavior, and hidden/visible states.
- Prefer responsive CSS primitives such as flex, grid, min/max constraints, aspect ratios, intrinsic sizing, and component-library layout APIs over copying Axure's absolute `left/top/width/height` values.
- Preserve visual relationships rather than literal pixels: item counts, relative order, alignment, hierarchy, density, selected states, and whether a panel grows with content matter more than matching one exported number.
- Use fixed dimensions only for genuinely fixed UI chrome or controls, such as icon rails, toolbar heights, icon buttons, avatars, known asset aspect ratios, or prototype elements whose behavior is explicitly fixed.
- When validating, compare screenshots at the agreed target viewport and judge whether the responsive implementation reads like the same current page. Do not reject an implementation solely because its CSS values differ from Axure's generated CSS.

## Viewport-Adaptive State Changes

When a prototype interaction shows/hides content, expands/collapses a side menu, or changes a panel state, preserve the page's intended viewport behavior. Do not let an internal state change accidentally create document-level scrollbars unless the Axure prototype clearly grows the page or uses a scrolling region.

- Determine the intended scroll model from the prototype: fixed app shell, fixed side rail, fluid main region, local scroll panel, or full document scroll. Treat this as part of the layout model.
- For app-like desktop pages, prefer a fixed viewport shell with `height: 100vh`, `min-height: 0`, flex/grid children, and local overflow regions. Hidden panels revealed inside the current page should usually consume reserved/adaptive space inside the main content area.
- Side menu expand/collapse should resize or reflow the adjacent main content area in place. It should not navigate, create body scroll, or push content below the viewport unless the original shell does that.
- If an interaction reveals a panel below an existing asset, first try responsive compression, reserved space, proportional heights, or local overflow within that content region. Only use body/page scroll when the original page visibly extends vertically or the user has requested document-style scrolling.
- Validate state changes at the target viewport by comparing `document.documentElement.scrollHeight` to the viewport height and by checking whether any scrollbar is intentional. A new body scrollbar after a local show/hide interaction is a defect unless documented as faithful to the prototype.

## Interaction Content Extraction

When an interaction reveals content, restore the revealed content as carefully as the initial page.

- For every `show`, `hide`, `set panel state`, drawer, modal, dynamic panel, repeater, or table action, parse the full target widget subtree before implementation. Do not summarize a revealed panel into a few invented fields.
- Cross-read `files/<page>/data.js`, `files/<page>/styles.css`, and the exported `<page>.html`. `data.js` is best for widget identity, hierarchy, geometry, visibility, and event targets; the exported HTML often preserves the final visible text for generated vector/table widgets. Use both sources to build the interaction content model.
- For hidden dynamic panels, record initial visibility, trigger widget, target widget id/label, animation, panel state, child widget count, child order, major grouping, tables, buttons, prompts, and nested interactions.
- For revealed information panels, preserve semantic grouping and column structure. If the Axure panel is visually three columns, implement a responsive three-column layout or an equivalent adaptive layout that keeps the same grouping and information density.
- For buttons inside revealed panels, copy the exact visible label from the Axure HTML/text layer. Do not infer labels from the action name or target panel label; for example, a button that opens a contact panel may still be labeled `分享`.
- For repeaters, preserve both the data rows and the item template controls. If a repeater row contains a checkbox, radio, status icon, avatar, row action, or selection state in the template, implement that control in the frontend table/list instead of only mapping the textual data columns.
- For table widgets, preserve the row/column grouping and visible cell text from the exported HTML when `data.js` stores cells as generated images or empty text nodes.
- Treat generated post-action content as a first-class acceptance target: after triggering the source widget, compare field counts, column counts, button labels, table rows, selectable controls, and nested panel behavior against the Axure page.

## Executable Page Data Extraction

Do not manually infer Axure structure by reading compressed `data.js` text or keyword-searching it. The primary parser must execute the page data script in a controlled local JavaScript environment, capture the object passed to `$axure.loadCurrentPage`, and recursively walk the resulting object graph.

Use this method for every entry page, priority page, interaction target page, and any page suspected to be a state variant:

1. Stub `$axure.loadCurrentPage` and execute `files/<page>/data.js` locally with Node or an equivalent JavaScript runtime. The script is local export data; do not browse or fetch remote resources to interpret it.
2. Capture the returned page object and recursively walk `page.diagram.objects`, nested `objects`, `objs`, `diagrams`, panel states, repeater templates, table cells, and grouped/layered widgets.
3. Emit or maintain a structured inventory with at least: `id`, `scriptId`, `label`, `friendlyType`, `type`, `visible`, `style.location`, `style.size`, text when available, images, `interactionMap`, dynamic panel states, repeater `data`, repeater `dataProps`, and parent/ancestor path.
4. Build indexes from that inventory: by id/scriptId, by label, by type, by visible state, by interaction target, and by parent dynamic panel/repeater/table.
5. Resolve each interaction target through the id index and inspect the full target subtree before coding. If a target is a hidden dynamic panel, recurse into all states and child widgets even though it is not visible initially.
6. Extract controls from repeater item templates, not only the repeater data set. Checkboxes, radios, avatars, action icons, row status widgets, and template layout are part of the data model for frontend restoration.
7. Extract table structure from table/tableCell nodes and cross-check visible cell text in the exported HTML when the executable object stores cells as generated images or empty text.
8. Use literal text search only after this executable extraction, for specific strings or to reconcile missing text. Never let keyword search replace the recursive inventory.

Minimum Node pattern:

```js
const fs = require("fs");
let page;
global.$axure = { loadCurrentPage: (value) => { page = value; } };
eval(fs.readFileSync("files/create-meeting/data.js", "utf8"));

function walk(node, ancestors = [], out = []) {
  if (!node || typeof node !== "object") return out;
  out.push({
    id: node.id,
    scriptId: node.scriptId,
    label: node.label,
    friendlyType: node.friendlyType,
    type: node.type,
    visible: node.visible,
    location: node.style?.location,
    size: node.style?.size,
    text: node.text,
    images: node.images,
    interactionMap: node.interactionMap,
    data: node.data,
    dataProps: node.dataProps,
    path: ancestors.map((item) => item.label || item.friendlyType || item.type || item.id).filter(Boolean),
  });
  for (const key of ["objects", "objs", "diagrams"]) {
    if (Array.isArray(node[key])) {
      for (const child of node[key]) walk(child, ancestors.concat(node), out);
    }
  }
  return out;
}

const inventory = walk(page.page.diagram);
```

If a selected stack uses TypeScript or Python tooling, the extractor may be wrapped in that tooling, but the core rule remains: execute the Axure page data script, capture the real object graph, and recursively inspect it before implementation.

## Semantic Component Inference

Axure widget types are authoring primitives, not frontend component truth. The conversion must infer product-level components from structure, repeated layout, labels, events, and route behavior before mapping to React/Vue/component-library code.

- Treat `friendlyType` as evidence, not a one-to-one mapping. Direct mappings are valid for clear controls such as text boxes, text areas, droplists, checkboxes, radios, tables, and repeaters, but many product controls are composed from labels, rectangles, images, groups, and dynamic panels.
- Any widget with an `interactionMap` is an interactive candidate even if it is a label, rectangle, image, vector shape, icon, line, or group. Parse its event cases and action sequence before deciding whether it is a button, icon button, menu item, tab, table row action, link, upload trigger, modal close control, or state toggle.
- Build a route graph from sitemap pages and `linkWindow` actions. When multiple pages repeat the same header/sidebar/menu chrome and menu items link to other pages, implement that repeated chrome as a shared application layout with a route outlet. The frontend route should update the main content area; do not duplicate the menu as separate page content just because Axure copied it onto every page.
- Detect state-variant pages by repeated visual chrome, repeated main content, reciprocal links, and names such as expanded/collapsed, default, no-share, video, share-screen, timeline, or similar state labels. Prefer component state for state variants unless the user explicitly wants Axure filenames preserved as routes.
- Infer menus from repeated vertical or horizontal groups of icon/text items, selected states, hover states, collapse/expand controls, and `linkWindow` targets. A copied Axure menu across pages should become a framework `Layout`/`Sider`/`Menu` or equivalent app shell component.
- Infer buttons from clickable labels, rectangles, image groups, icon+text groups, and styled shapes. Preserve the visible text from the exported page, not the event action name. If a button-looking label opens a panel or route, implement it as a button or link according to product behavior.
- Infer forms from clustered label/input/select/checkbox/radio/button widgets inside a panel or page region. Convert the cluster into library form items, preserving labels, placeholders, defaults, required marks, hints, validation states, submit/cancel actions, and local panel behavior.
- Infer toolbars and filter bars from compact label/input/select/date/button groups above tables, lists, calendars, or dashboards. Convert them into toolbar/filter components instead of loose positioned labels.
- Infer upload components from a visible drop area, image/icon placeholder, upload wording, file hints, or event-bearing label/icon groups. Implement with the selected library's upload component when behavior is upload-like, even if Axure used only a label, image, or rectangle.
- Infer tabs, segmented controls, and setting categories from repeated selectable labels/groups that set selected state or switch dynamic panel states. Implement them as tabs, segmented controls, menu groups, or side settings navigation according to layout.
- Infer dialogs, drawers, popovers, and confirmation panels from hidden dynamic panels, overlays, fixed positioning, bring-to-front actions, close icons, and show/hide actions. Restore the full hidden subtree and interaction behavior.
- Infer data tables and selectable lists from repeaters/tables plus row templates. Preserve selection controls, row actions, avatars/status icons, data bindings, and template layout, not just textual columns.
- Keep an "Axure widget -> semantic component -> frontend component" mapping note in the generated README for all inferred components that are not direct one-to-one mappings.

## Mandatory User Decision Gates

Ask and wait for explicit user choices at these points. Do not proceed past a gate by choosing the first option, using a default, or making an assumption unless the user has explicitly requested automatic decisions. Batch related questions so the user can answer efficiently.

### Before Analysis

1. Entry page: ask which Axure page should be the product entry page. If the sitemap is available, list detected page names.
2. Frontend stack: ask the user to choose one of:
   - `React + Vite + TypeScript + Ant Design`
   - `Vue 3 + Vite + TypeScript + Element Plus`
   - `Vue 3 + Vite + TypeScript + Ant Design Vue`
3. Prototype type: ask whether the source is a web page prototype or mobile prototype.
4. Output location: ask for project directory/name, or ask permission to initialize in the current working directory.

### After Analysis

Show detected pages, likely route mapping, state variants, special Axure capabilities, major data sets, and major assets. Then ask the user to confirm:

1. Conversion scope: all detected pages or selected pages only.
2. Route strategy: accept proposed product routes, edit route names, or keep a closer Axure filename mapping.
3. State consolidation: merge Axure pages that are only screen states into component state, or keep them as separate routes.
4. Restoration depth:
   - Static visible-page restoration: only restore selected visible page/state UI, no event/interaction/hidden-trigger implementation.
   - Full prototype restoration: restore visible UI plus events, interactions, conditions, flows, hidden panels, repeaters, tables, and state changes.
5. Asset strategy exceptions: use framework icons for generic UI icons, but ask before replacing any ambiguous product-specific icon or visual asset.
6. Responsive targets: desktop/tablet/mobile breakpoints for web prototypes, or target device widths for mobile prototypes.
7. Data handling: keep all prototype data as local typed mock data, or prepare an API/data-service layer without real backend calls.
8. Implementation order: ask which page or flow to implement first when the prototype is large.

If a decision materially changes architecture, routes, component boundaries, assets, or implementation effort, ask the user instead of silently choosing.

## Core Rules

- Ignore Axure-generated player/start files such as `start.html`, `start_c_1.html`, `start_with_pages.html`; treat `index.html` as generated unless the sitemap or user explicitly identifies it as a real prototype page.
- Prefer `data/document.js` for sitemap/page relationships and `files/<page>/data.js` plus `files/<page>/styles.css` for page-specific objects and interactions.
- For page-level structure, execute `files/<page>/data.js` and recursively extract the object graph. Do not rely on visual guessing, compressed source reading, or keyword-only grep to understand dynamic panels, repeaters, tables, checkboxes, buttons, or interaction targets.
- Treat Axure interactions as executable behavior to interpret, not decoration. Build a behavior model of events, conditions, variables, action sequences, style states, target widgets, and visible results before coding.
- Honor the selected restoration depth. In static visible-page restoration, document interaction and hidden-panel findings but do not implement them. In full prototype restoration, implement them as first-class requirements.
- Build a page-chrome inventory before coding: top bars, side rails, global navigation, user/system controls, repeated icon groups, collapsed/expanded states, and shared shell proportions. Count all visible navigation/menu icons even when they are unlabeled image widgets.
- Treat pages named like `*-menu-expend`, `*-menu-expand`, `*-sidebar-*`, or pages that only change a shared shell's rail width as state variants until proven otherwise. Use them to implement local sidebar/menu expansion state, not as product routes or business pages by default.
- Anchor every interaction to its Axure source widget and target widget. Hidden dynamic panels should remain hidden initially and appear in the same page region when the source event says `show`; their internal controls must not be promoted into the initial visible form.
- Do not replace one Axure call-to-action with multiple invented buttons. Keep button count, labels, and initial visibility faithful unless the user explicitly approves a product redesign.
- Preserve prototype data exactly unless the user asks to change it. Do not invent extra records, labels, sections, or layout.
- Copy and use non-icon prototype visual assets such as screenshots, avatars, brand marks, diagrams, PNG/JPG photos, and content images from the Axure export. Do not replace real content/brand/image assets with placeholders. If an asset is a generic UI icon, prefer the selected frontend icon library instead of copying the Axure image, and document meaningful replacements when needed. If a referenced non-icon asset is missing, document the missing path and visible impact in `README.md`.
- Do not preserve Axure page names as final route names by default. Derive clean product routes from page intent, then document the mapping in `README.md`.
- Recreate layout similarity and information hierarchy, not Axure's fixed pixel canvas. Output must be responsive for the selected web/mobile target.
- Preserve the prototype's scroll model during state changes. Showing hidden panels or expanding menus should reflow within the intended app viewport or local region, not accidentally create body scrollbars.
- Use the selected component library first. Build custom components only when no equivalent component exists or when the library component would lose the prototype behavior.
- For lists, repeaters, and tables, infer column widths from content: fixed-action/icon/status columns stay fixed; variable text columns flex to content/available space. Never distribute all columns equally by default.

## Visual Fidelity Validation

For each implemented entry or priority page, validate against the Axure page before considering the page complete:

- Capture or inspect the Axure page at the target desktop viewport and compare it with the frontend at the same viewport.
- Check page chrome first: title bar, right-side controls, side menu proportion, toggle affordance, menu item count, selected item, and expanded/collapsed variants.
- Check the main content next: panel proportions and adaptive height behavior, field count/order, control states, icon colors, asset placement, and hidden/visible panels.
- Trigger the primary page interaction and verify the resulting local state against Axure actions, especially hidden dynamic panels, repeaters, copy prompts, contact panels, and generated invitation/details sections.
- For every revealed panel, validate visible text, column/group structure, button labels, table cell text, repeater row count, and selection controls such as checkboxes or radios.
- Validate viewport behavior after interactions: side menu expansion and hidden-panel reveal should preserve the intended shell size and should not introduce document-level scrollbars unless the prototype itself does.
- Record any intentional deviation in `README.md`; otherwise fix the implementation rather than explaining the mismatch away.

Apply validation according to the selected restoration depth:

- Static visible-page restoration: validate only selected visible pages/states, visible chrome, visible content, visible controls, visible assets, responsive behavior, and scroll model. Do not fail the build for unimplemented hidden panels or interactions when they were explicitly out of scope; document them as skipped.
- Full prototype restoration: validate both visible pages and triggered states, including hidden panels after reveal, event outcomes, repeater controls, conditions, cross-page navigation, dialogs, copy prompts, and viewport behavior after each primary interaction.

## Required README

Create `README.md` in the generated project with:

- Selected stack and prototype type.
- Selected restoration depth and what it includes/excludes.
- Axure entry page and generated route mapping.
- Page-to-page interaction flow as a Mermaid diagram.
- Important page-internal events, conditional branches, variable/state changes, and action sequences as Mermaid diagrams or concise descriptions.
- Component mapping notes for dynamic panels, repeaters, tables, inline frames, dialogs, forms, and custom components.
- Copied asset inventory or summary, including any missing assets.
- Validation checklist covering layout similarity, route coverage, data preservation, key interactions, component-library replacement, custom implementation gaps, and responsive behavior.

## References

- Read `references/axure-analysis.md` when analyzing Axure export structure, page data, assets, and interactions.
- Read `references/axure-official-capabilities.md` when checking Axure's supported prototype capabilities against the export.
- Read `references/frontend-mapping.md` when choosing commands, route structure, component mappings, responsive layout rules, and validation criteria.
