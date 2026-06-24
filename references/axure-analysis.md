# Axure 11 Export Analysis

Before analyzing export files, read `axure-official-capabilities.md` and keep its capability checklist open. The goal is to recover Axure's interaction semantics, not just visible HTML/CSS.

## Source Priority

Use these sources in order:

1. `data/document.js`: sitemap, page names, page URLs, global styles, custom styles, adaptive views, global variables, and plugin lists.
2. `files/<page>/data.js`: page object tree, widget metadata, interaction maps, event scripts, conditions, actions, variables, dynamic panel diagrams, repeater data, and page-level events.
3. `files/<page>/styles.css`: generated coordinates, sizes, typography, fills, borders, and visibility hints.
4. `images/<page>/` and shared resources: bitmap/SVG assets that represent icons, screenshots, or complex visuals. Non-icon visual/content assets must be copied into the generated frontend project and used directly; do not substitute placeholders. Generic UI icons may be replaced with equivalent icons from the selected frontend icon library.
5. Root `<page>.html`: page shell and script references. Do not treat player/start pages as implementation pages.

Ignore generated Axure player files: `start.html`, `start_c_1.html`, `start_with_pages.html`, `resources/**`, `plugins/**`, and usually `index.html`. Treat `index.html` as a real prototype page only when the user or sitemap confirms it.

## First-Pass Scan

Run:

```bash
python <skill-dir>/scripts/inspect_axure_export.py <axure-export-dir> --out axure-analysis.json
```

Use the JSON as a guide, not as the only source. Axure 11 often compresses page data into variable assignments, so the script intentionally extracts stable clues: pages, root HTML candidates, per-page data files, asset counts, keyword counts, script/interaction counts, and link targets.

## Page Inventory

Build a page table with:

- Axure page name.
- Source URL/file.
- Data file path.
- Intended route name, derived from business intent rather than Axure filename.
- Page type: main page, modal-like page, state variant, detail page, embedded content, or uncertain.
- Major widgets and special Axure features.
- Incoming and outgoing navigation.

When multiple Axure pages are state variants of one product screen, prefer one frontend route with component state instead of one route per Axure file. Document that consolidation in `README.md`.

## Fidelity Ledgers

For each priority page, produce three ledgers before implementation:

- Code structure ledger: widget ids/scriptIds, parent/group/dynamic-panel path, Axure type, semantic role, event map, target widgets/pages, and chosen frontend component.
- Style ledger: CSS selector, x/y/width/height, typography, fill, border, opacity, radius, image/SVG asset, selected/hover/disabled state styles, and relative grouping.
- Data/text ledger: exact text from exported HTML, default values, select options, checkbox/radio state, table/repeater rows, hidden panel content, URLs, passwords, date/time rows, and button labels.

Before semantic route/component inference, freeze evidence from those ledgers:

- Content inventory: all visible text, title attributes, menu labels, item order, selected states, form labels, default values, and action labels. Visible UI wording must remain exact; route names and internal component names may be normalized separately.
- Control inventory: all `textBox`, `comboBox`, `checkbox`, `radioButton`, repeater/table controls, clickable labels/shapes/groups, and widgets with `interactionMap`. A direct Axure text field must remain a frontend input/date picker/select according to source context, not a static label.
- Style-structure inventory: all rectangles, borders, fills, groups, and selector scopes around controls. When replacing Axure controls with a framework component, do not add extra wrapper chrome unless a matching Axure object exists.

Use these ledgers to catch common false restorations:

- `text_field + calendar icon + date value` is a date picker intent. Record it as a DatePicker candidate and verify frontend operability.
- Checkboxes/radios require both data state and style state. Extract the SVG/CSS appearance and any surrounding Axure rectangle separately. Distinguish an Axure outer option rectangle from the checkbox itself so the frontend does not create an extra inner bordered box.
- Hidden dynamic panels require full text/data extraction from their subtree and HTML, especially post-action invitation/detail panels.
- Sidebars and menus require exact title/text labels, icon count/order, separators, selected state, toggle control, collapsed/expanded dimensions, and link targets. Do not replace current-page menu wording with sitemap names or product assumptions.

## Interaction Extraction

Search page `data.js` for these stable interaction/action clues:

- Event containers: `interactionMap`, `eventType`, `OnClick`, `OnLoad`, `OnMouseEnter`, `OnMouseOut`, `OnMouseDown`, `OnMouseUp`, `OnSelectedChange`, `OnTextChange`, `OnItemLoad`, `onBeforeItemLoad`, `OnDrag`, `OnSwipe`, `OnMove`, `OnResize`.
- Conditional logic: `cases`, `conditionString`, `isNewIfGroup`, `disabled`, `expr`, `exprType`, `subExprs`, `fcall`, `functionName`, `arguments`, `booleanLiteral`, `stringLiteral`, `pathLiteral`.
- Variables and state: `globalVariables`, `OnLoadVariable`, `setVariable`, `SetGlobalVariableValue`, `setFunction`, `SetCheckState`, `selected`, `focused`, `enabled`, `visible`, `text`, `sto`, `item`.
- Navigation: `linkWindow`, `targetType`, `.html`, `includeVariables`, `linkType`.
- Dynamic panels: `dynamicPanel`, `diagrams`, `setPanelState`, `stateNumber`, `stateValue`, `showWhenSet`.
- Visibility and modal behavior: `fadeWidget`, `show`, `hide`, `lightbox`, `bringToFront`, `wait`.
- Forms and state: `textBox`, `comboBox`, `checkbox`, `radioButton`, `setFunction`, `SetCheckState`, `SetWidgetRichText`.
- Repeaters/data: `repeater`, `onBeforeItemLoad`, `repeaterPropMap`, `data`, `Item.`, column names.
- Tables: `table`, `tableCell`, repeated cell-like objects, aligned rows/columns in CSS.
- Inline frames: `inlineFrame`, `iframe`, embedded URL paths.
- Motion and timing: `moveWidget`, `rotateWidget`, `sizeWidget`, `scrollToWidget`, animation descriptions, `duration`, `durationHide`, `easing`, `wait`, `waitTime`.
- Style states: `stateStyles`, `mouseOver`, `mouseDown`, `focused`, `selected`, `disabled`, `hint`, `selectedDisabled`, custom style names.
- Adaptive behavior: `adaptiveViews`, `adaptiveStyles`, `viewOverride`, `sketchFactor`.
- Advanced actions: `addFilter`, `removeFilter`, `addSort`, `removeSort`, `setCurrentPage`, `setItemsPerPage`, `addRows`, `updateRows`, `deleteRows`, `markRows`, `unmarkRows`, `fireEvent`, `raiseEvent`, `setAdaptiveView`, `applyStyle`, `setOpacity`, `setImage`.

For every important interaction, record trigger, source widget label, action sequence, target widget/page, and expected visible result. Implement the business effect, not the Axure player mechanics.

## Script Behavior Model

Create a behavior model before writing frontend code. For each page, produce:

- Event table: event type, source widget, human label, triggering gesture, and affected widgets/pages.
- Case table: conditions, else/if grouping, disabled cases, and branch outcomes.
- Action sequence: ordered actions such as set panel state, show/hide, move, wait, set selected, set text, set variable, open link, fire event, or raise modal/lightbox.
- State store: page state, global variables, selected/focused/enabled/visible flags, form values, repeater data, and dynamic panel states.
- Side effects: navigation, visibility changes, text/data mutation, validation hints, animations, scroll, and modal overlays.

When Axure scripts use expressions, translate the expression's intent into typed frontend state/computed logic. Do not copy Axure's generated runtime calls directly.

## Event and Action Mapping

Map Axure events to frontend handlers:

- Click/tap events -> button/menu/list-item handlers.
- Hover/mouse states -> CSS hover or component state only when behavior changes.
- Load events -> initial state setup, route guards, or component lifecycle hooks.
- Text/change events -> controlled form state and validation.
- Selected/change events -> radio/checkbox/tab/segmented state.
- Repeater item load -> render callbacks, computed columns, row mappers, or scoped slots.
- Drag/swipe/move events -> pointer/touch handlers or a small custom interaction module.

Preserve action order when order changes the visible result. Keep waits and animations only when they communicate user feedback or state transitions; avoid recreating Axure-only playback effects that have no product meaning.

## Style and Theme Analysis

Analyze style beyond static CSS:

- Default document styles and custom styles in `data/document.js`.
- Widget style, generated CSS, state styles, mouse-over/down/focused/selected/disabled variants.
- Theme colors, typography, border radii, shadows, opacity, overlays, and spacing patterns.
- Adaptive styles and view overrides.

Use styles to infer the design system and component variants. Exact pixel values are reference material, not fixed output constraints.

## Special Widget Interpretation

Dynamic panels map to component state, tabs, segmented controls, drawers, popovers, dialogs, accordions, carousels, or conditional regions depending on behavior. Preserve state names and transitions when they express business meaning.

Repeaters map to typed arrays plus table/list/grid/card rendering. Extract all prototype rows and columns. Keep prototype values exactly.

Tables map to the selected component library table when possible. Preserve fixed columns, action columns, status tags, row selection, sorting, pagination, and empty states when present.

Inline frames map to iframe components only when the prototype truly embeds external content. If the frame is only a placeholder for another prototype page, convert it into a routed/component composition when practical.

Images/SVGs map to copied project assets when they represent real product imagery, screenshots, avatars, brand marks, diagrams, icons with no library equivalent, or complex visuals. Replace generic UI icons with framework/library icons when the semantics match and the original asset is not product/brand/content-specific. Never use placeholder boxes or placeholder images for non-icon assets that exist in the Axure export.

## Asset Handling

Inventory all referenced assets from root HTML, `files/<page>/data.js`, `files/<page>/styles.css`, and `images/**`. Classify each important asset as `generic-ui-icon`, `brand`, `content-image`, `avatar`, `screenshot`, `diagram`, `font`, or `unknown`.

- Copy SVG, PNG, JPG, JPEG, GIF, WebP, ICO, font, and other non-icon visual resources needed by implemented pages into the generated project, preferably under `src/assets/axure/` or `public/axure-assets/` according to the framework's conventions.
- Preserve relative grouping when it helps trace the source page, for example `images/create-meeting/u47.png` -> `src/assets/axure/create-meeting/u47.png`.
- Reference copied files from components/CSS using normal imports or public URLs.
- Keep original filenames when practical; sanitize only when the frontend toolchain cannot handle a filename.
- If a referenced asset is a generic UI icon and the selected framework has a semantically equivalent icon, use the framework icon instead of copying the Axure image.
- If an asset is referenced but absent, record the missing source path, page, and expected visual role in the conversion checklist and `README.md`.

## Layout Reading

Use CSS positions and sizes to infer layout hierarchy:

- Cluster elements by alignment, spacing, and visual containment.
- Identify headers, nav bars, sidebars, content regions, toolbars, forms, cards, lists, dialogs, and overlays.
- Convert absolute coordinates into responsive flex/grid/component layouts.
- Keep information density and relative relationships, not the fixed Axure canvas size.
- For mobile prototypes, prioritize the supplied mobile viewport structure and touch-friendly controls.

## Ambiguity Handling

When Axure data is ambiguous, inspect the rendered HTML visually if possible and state the assumption in the conversion checklist. Do not add features or data to "complete" a screen unless the prototype already implies them.
