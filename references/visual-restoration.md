# Visual Restoration Gate

Use this reference whenever visual fidelity, layout drift, or "looks unlike the prototype" is a risk. This gate is blocking: component correctness and data correctness do not pass a page if the first rendered screen no longer resembles the Axure source.

## Purpose

Restore the prototype, do not redesign it as a generic product UI.

Framework components may improve operability and may use framework color tokens. Exact color matching is not required unless the user asks for pixel-level visual restoration. The blocking requirement is that components live inside the same visual skeleton as the Axure page. A conversion that swaps left/right content regions, removes a dominant map/image, changes the app shell structure, or makes hidden post-action content visible on initial load is a failed restoration even if text and controls are mostly correct.

## Required Visual Baseline

Before implementing a selected page, capture or inspect the rendered Axure page at the agreed reference viewport. Record a visual baseline ledger with:

- Reference viewport width and height.
- Initial visible state and any hidden interaction states.
- User-selected target theme, body background, source contrast hierarchy, primary surface roles, border rhythm, and font scale.
- App shell regions: header, sidebar, icon rail, content area, route outlet, selected menu item, collapse/expand control.
- Major content regions with relative position: left/right/top/bottom order, approximate x/y/w/h, alignment, and z-order.
- Dominant assets: brand marks, maps, screenshots, avatars, product imagery, diagrams, and media placement.
- Empty or reserved regions that are intentionally visible.
- Scroll model: body scroll, local panel scroll, fixed shell, sticky regions, and expected no-scroll states.
- Initial action visibility: buttons, generated panels, dialogs, drawers, popovers, and post-action results.

Store the ledger as `visual-baseline` or include it in the page layout ledger. It should be source-derived from rendered Axure plus CSS/data, not from product assumptions.

## Theme And Color Tolerance

Theme is a user decision; exact colors are a tolerance choice.

Ask the user to choose the target light or dark theme before conversion. Do not choose it from the Axure export. Use Axure colors to preserve source hierarchy and identify conflicts:

- Record body/page background, dominant panel fills, text contrast, form control fills, border colors, and header/sidebar colors.
- If the source mostly uses dark backgrounds and the user chose light, preserve layout and hierarchy with framework light tokens, then document contrast/color deviations.
- If the source mostly uses light backgrounds and the user chose dark, preserve layout and hierarchy with framework dark tokens, then document contrast/color deviations.
- If a page intentionally mixes dark and light surfaces, preserve that page-specific composition as much as practical within the chosen target theme instead of flattening it into one generic palette.

Do not chase exact Axure hex colors by default. Use the selected framework's normal tokens when they keep the same contrast role and visual hierarchy. Ask the user when the selected target theme conflicts with source-critical contrast or brand/product surfaces.

## Layout Lock Rules

At the reference viewport:

- Preserve the visual topology before applying responsive abstraction.
- Do not invert columns or move a form/map/list/panel to a different region unless Axure evidence shows a state change.
- Do not add page titles, top actions, extra cards, side navigation labels, helper alerts, or dashboard chrome without Axure evidence.
- Do not let framework defaults change the page structure. Framework colors are acceptable; framework layout chrome is not.
- Do not make post-action panels visible in the initial state unless the Axure page shows them initially.
- Do not position modal-like hidden dynamic panels by stale canvas coordinates when Axure CSS exports them as fixed/pinned/lightbox overlays. Preserve their fixed centering, margins, and z-order.
- Do not collapse separate Axure regions into one generic card when their visual separation is explicit.
- Do not add inner borders, wrappers, or grouped containers around controls unless a matching Axure rectangle/group exists.
- Preserve dominant visual assets. If a map, product screenshot, avatar, or diagram dominates the prototype, it must dominate the restored screen too.
- Preserve shared shell proportions and menu item order from the Axure page or repeated chrome ledger.

Responsive CSS may use flex, grid, and percentages. The first acceptance target is still similarity at the reference viewport; only after that should the layout be generalized.

## Visual Skeleton Task

For each page, create a page-visible restoration task before component polish:

- Recreate global background and app shell.
- Place major regions using the visual baseline.
- Copy or reference dominant assets.
- Render only initially visible panels.
- Reserve the same visual whitespace and scroll behavior.
- Add simple placeholder child blocks only when needed to validate geometry, then replace them with mapped components.

Do not start semantic rearrangement until the visual skeleton screenshot matches the Axure baseline.

## Blocking Validation Gates

A page is not accepted until these gates pass:

- **Skeleton gate**: major region count, order, placement, and scale match the Axure screenshot.
- **Theme gate**: user-selected theme is applied while source surface hierarchy, borders, and density remain recognizable. Exact hue/hex matching is optional unless requested.
- **Asset gate**: all primary non-icon visual assets are present and occupy the same functional region.
- **State gate**: initial visible/hidden content matches; post-action panels only appear after the source event.
- **Overlay geometry gate**: fixed modal/dialog/popover/drawer targets preserve exported fixed/pinned coordinates, centering, and front-layer stacking after the triggering event.
- **Coverage gate**: every extractor `mustImplement` item is implemented, intentionally covered by a parent component, or documented as an approved omission.
- **No-invention gate**: no extra page chrome, action buttons, cards, alerts, wrappers, or labels appear without Axure evidence.
- **Scroll gate**: body/local scroll behavior follows the prototype at the reference viewport.
- **List/table scroll gate**: lists, repeaters, and tables must not create local scrollbars unless the Axure widget or baseline rendering shows local scrolling. Framework list/table defaults that add scrollbars, min-width expansion, or internal overflow are restoration failures.
- **Component geometry gate**: framework controls keep the Axure control width, inline label placement, and row alignment from the layout ledger; internal framework markup must not be restyled as if it were Axure source markup.
- **Screenshot gate**: rendered frontend screenshot is compared against rendered Axure screenshot before completion.

If any gate fails, fix the layout before spending more effort on component refinement or interaction coverage.

## Failure Patterns

Treat these as hard failures:

- The prototype is a map-and-form workspace, but the result is a generic admin dashboard.
- The prototype has a narrow icon rail, but the result has a wide labeled sidebar.
- A right-side map or image is missing and replaced by tables/cards.
- A left form panel becomes a right form panel without source evidence.
- Generated invitation content appears on initial load when it should be hidden until clicking a button.
- The implementation invents secondary buttons, alerts, or title bars that do not exist in Axure.
- A framework component's default border/wrapper changes the original grouping structure.

## Interaction States

For full restoration, each important interaction state needs its own visual baseline:

- Before event.
- After event.
- Dialog/drawer/popover open.
- Panel state variant.
- Repeater/table selected or filtered state when visible in Axure.

Validate each state separately. Do not use a post-action screenshot to justify an initial-state layout.
