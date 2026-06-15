# Axure Official Capability Checklist

Use this checklist before deciding implementation scope. Axure exports can encode high-fidelity behavior; a conversion that ignores these capabilities is only a static page recovery.

Primary official references:

- Events, cases, and actions: https://docs.axure.com/axure-rp/reference/events-cases-actions/
- List of events: https://docs.axure.com/axure-rp/reference/events-list/
- List of actions: https://docs.axure.com/axure-rp/reference/actions-list/
- Dynamic panels: https://docs.axure.com/axure-rp/reference/dynamic-panels/
- Repeaters: https://docs.axure.com/axure-rp/reference/repeaters/
- Adaptive views: https://docs.axure.com/axure-rp/reference/adaptive-views/
- Conditional logic: https://docs.axure.com/axure-rp/reference/conditional-logic/
- Variables: https://docs.axure.com/axure-rp/reference/variables/
- Math, functions, and expressions: https://docs.axure.com/axure-rp/reference/math-functions-expressions/
- Style effects: https://docs.axure.com/axure-rp/reference/style-effects/
- Animations: https://docs.axure.com/axure-rp/reference/animations/
- Components and raised events: https://docs.axure.com/axure-rp/reference/creating-and-using-components/ and https://docs.axure.com/axure-rp/reference/raised-events/

## Interaction Model

Analyze Axure interactions as:

1. Event: page, component, widget, form, dynamic panel, or repeater trigger.
2. Case: optional IF/ELSE conditional branch.
3. Action sequence: ordered operations executed by the case.

Do not start implementation until each important page has an event/case/action inventory.

## Events To Check

Page and component events:

- Click/tap, double click/tap, context menu, mouse move.
- Page/component loaded.
- Window resized or scrolled when present in the export.

Widget events:

- Click/tap, double click/tap, mouse enter, mouse out, mouse down, mouse up.
- Selected, unselected, selected-or-unselected.
- Loaded.

Form events:

- Droplist/list box selection changed.
- Text field/text area text changed.
- Submit-button behavior for text inputs or list controls.

Dynamic panel events:

- Panel state changed.
- Drag started, dragged, drag dropped.
- Swiped left/right/up/down.
- Scrolled up/down/any direction.

Repeater events:

- Item loaded.
- Item resized.

## Actions To Check

Links:

- Open link to prototype page or external URL.
- Open link in current window, new window/tab, popup, parent window.
- Open link in frame or parent frame.
- Close window.
- Scroll to widget.

Widgets:

- Show/hide.
- Set panel state.
- Set text, including rich text.
- Set image.
- Set selected/checked.
- Set selected list option.
- Set error state.
- Enable/disable.
- Move, rotate, set size.
- Bring to front/back.
- Apply style.
- Set opacity.
- Focus.
- Expand/collapse tree node.

Variables and expressions:

- Set variable value.
- Read global variables in text, conditions, and expressions.
- Evaluate math/functions/expressions from fx fields.

Repeaters:

- Add/remove sort.
- Add/remove filter.
- Set current page.
- Set items per page.
- Add, mark, unmark, update, and delete dataset rows.

Miscellaneous:

- Set adaptive view.
- Wait.
- Other placeholder action.
- Fire event.
- Raise event from component to page level.

## Structure And Component Capabilities

Dynamic panels:

- States, default visible state, state ordering, fit to content, scroll modes, 100% wide, pin to browser, keep in front, lightbox-like overlays, drag/swipe/scroll behavior, and event conflicts between panel and contained widgets.

Repeaters:

- Dataset columns/rows, item template, widget-to-column bindings, imported data, pagination, sorting, filtering, dataset mutation, and item load/resized behavior.

Adaptive views:

- Alternate page layouts for screen sizes, inherited view sets, per-view repositioning/resizing/restyling, and browser-size-based view switching.

Components:

- Reusable components, component views, instance-level behavior, and raised events that bubble from component internals to page-level handlers.

Style effects and animation:

- Mouse over, mouse down, selected, disabled, focused, hint, and error style effects.
- Apply-style transitions, easing, duration, transform origin, move/size/rotate animation, opacity, show/hide effects.

## Conversion Requirement

For every capability detected in the Axure export:

- Implement the equivalent frontend behavior when it has product meaning.
- Document any deliberately omitted Axure-only playback behavior.
- Add a README note when a capability is approximated by a component-library equivalent.
- Add a validation task that exercises the behavior in the generated app.
