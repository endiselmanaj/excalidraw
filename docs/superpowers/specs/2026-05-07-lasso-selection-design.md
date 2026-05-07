# Lasso Selection Tool — Design

**Branch:** `challenge/excalidraw-lasso-selection`
**Date:** 2026-05-07
**Status:** approved, ready for implementation plan

## Goal

Implement a freehand lasso selection tool for Excalidraw. The user activates the tool, drags a loop on the canvas, and releases. Elements that the loop encloses *or* whose outlines the loop crosses become selected. Selection updates live during the drag. Shift+drag adds to the existing selection.

The path is rendered as an animated dashed trail while drawing, distinct from the eraser's solid trail and the laser's tapered trail.

## Non-goals

- No polygonal click-to-place lasso (no Photoshop-style "click each vertex"). Drag only.
- No magnetic / snap-to-edge behavior.
- No editing of an existing lasso path. Once released, the path is gone; the selection is in `appState.selectedElementIds`.
- No new exposed API on the public `@excalidraw/excalidraw` package surface beyond the new tool type.

## Selection semantics

Two ways an element gets selected:

1. **Enclosure** — at least one point on the element's outline is inside the closed lasso polygon (non-zero winding rule).
2. **Intersection** — the element's outline crosses the lasso polygon's perimeter.

If the user releases without manually closing the loop, the path is treated as closed by an implicit straight segment from the last point to the first.

Plus a special case: if the lasso is drawn entirely *inside* a large filled shape, that shape is selected. Mirrors `EraserTrail`'s `shouldTestInside` + `isPointInElement` check.

## Architecture

```
packages/excalidraw/lasso/
├── index.ts          # LassoTrail class (extends AnimatedTrail)
└── utils.ts          # pure geometry helpers
```

`LassoTrail` is modeled on `packages/excalidraw/eraser/index.ts`. It:

- extends `AnimatedTrail` with `animateTrail: true` (dashed animated stroke)
- exposes `startPath(x, y)`, `addPointToPath(x, y)`, `endPath()` from the base
- maintains an internal `selectedElementIds: Set<string>` and a `groupsToSelect: Set<string>`, recomputed on every `addPointToPath`
- exposes `selectionFromPath(): Set<string>` for App.tsx to read on each pointer-move

`utils.ts` exposes one main function:

```ts
isElementInsideLasso(
  element, elementsMap, lassoPolygon, lassoBounds, lassoSegments, zoom
): boolean
```

Group / bound-text / container expansion stays in `LassoTrail` (same location as in `EraserTrail`) so `utils.ts` is purely geometric.

## Geometry predicate (`isElementInsideLasso`)

`LassoTrail` owns these computations (App.tsx never touches the math). Per `addPointToPath`, it computes:

- `lassoPoints: GlobalPoint[]` — the trail's `originalPoints`
- `lassoPolygon = polygon(...lassoPoints)`
- `lassoBounds: Bounds = [minX, minY, maxX, maxY]`
- `lassoSegments: LineSegment[]` — adjacent pairs, **plus** the closing segment (last → first)

Per element, in order:

1. **AABB pre-filter.** `if (!doBoundsIntersect(getElementBounds(element, map), lassoBounds)) return false`. Skips most of the canvas.
2. **Inside-fillable shortcut.** If `shouldTestInside(element)` and `isPointInElement(lassoPoints[0], element, map)` → `true`. Selects a large shape when the user drew the lasso wholly inside it.
3. **Enclosure.** Compute element outline points (via `getElementLineSegments(element, map)` for most types; `getFreedrawOutlinePoints` for freedraw). If any outline point is inside `lassoPolygon` (`polygonIncludesPointNonZero`) → `true`.
4. **Intersection.** For arrows / unfilled lines / freedraw, use the `lineSegmentsDistance(elementSeg, lassoSeg) ≤ tolerance` pattern from `EraserTrail` (tolerance scales with zoom). For other elements, use `intersectElementWithLineSegment(element, map, lassoSeg, 0, true).length > 0` for each lasso segment. → `true` on first hit.
5. Otherwise `false`.

Tolerance and freedraw handling mirror `EraserTrail`'s constants verbatim — no tuning.

## Special-case expansion

After the raw set is computed in `LassoTrail.updateSelection()`, expand it (same loop pattern as `EraserTrail.updateElementsToBeErased()`):

- **Bound text → container:** if a selected element `isBoundToContainer`, also add `element.containerId`.
- **Container → bound text:** if a selected element `hasBoundTextElement`, also add `getBoundTextElementId(element)`.
- **Group:** for each newly selected element, take `element.groupIds.at(-1)` (shallowest group) and `getElementsInGroup(map, groupId)`, add all of them.
- **Frame:** no special expansion. The frame element itself is tested like any other element (its outline is in `visibleElements`); its children are also tested independently. So a lasso around a frame selects the frame *and* whichever children's outlines were also touched. This matches user intent and the rubric's "frames select as units" — the frame becomes a selected element; downstream UI (drag, resize) already treats a selected frame as a unit.
- **Locked elements:** filtered out at the candidate stage (`!el.locked`), same as eraser.

## Shift-additive behavior

Lives in App.tsx pointer-down handler. On `pointer-down` with `event.shiftKey === true`:

```ts
const baseSelection = { ...appState.selectedElementIds };
```

Without shift, `baseSelection = {}`. On each pointer-move, App.tsx computes `selectionFromPath()` and dispatches:

```ts
setState({ selectedElementIds: { ...baseSelection, ...lassoSelection } });
```

`baseSelection` is a snapshot, so an element selected at pointer-down stays selected even if the lasso doesn't cover it.

## App.tsx wiring

Modeled on the existing eraser wiring. Locations are approximate — actual diff lives in the implementation plan.

- **Field (~line 705):** `lassoTrail = new LassoTrail(this.animationFrameHandler, this);` next to `laserTrails` and `eraserTrail`.
- **Render (~line 2211):** include `this.lassoTrail` alongside `laserTrails` / `eraserTrail` in the SVG container render.
- **Cleanup (~line 3208):** `this.lassoTrail.stop();` next to the existing two stops.
- **`handlePointerDown`:** if `activeTool.type === "lasso"`, snapshot `baseSelection`, call `this.lassoTrail.startPath(sceneX, sceneY)`, and short-circuit before the rectangle-selection / element-drag branches.
- **`handlePointerMove`:** if lasso path is active, call `this.lassoTrail.addPointToPath(sceneX, sceneY)`, then dispatch `selectedElementIds = { ...baseSelection, ...this.lassoTrail.selectionFromPath() }`. Short-circuit element-drag / resize branches.
- **`handlePointerUp`:** `this.lassoTrail.endPath();`. Selection is already in state — no extra commit step.

## UI surface

**1. Constants and types** — `packages/common/src/constants.ts`

Add `lasso: "lasso"` to `TOOL_TYPE`. The `ActiveTool["type"]` union derives from `TOOL_TYPE`, so type sites pick it up automatically. Switch / exhaustive-check sites that need a `case "lasso":` get one.

**2. Toolbar** — `packages/excalidraw/components/shapes.tsx`

Append between `eraser` and `laser`:

```ts
{ icon: LassoIcon, value: "lasso", key: null, numericKey: null,
  fillable: false, toolbar: true }
```

`key: null` — activation is a chord (Ctrl+Alt), not a single letter. `toolbar: true` makes it visible on desktop and (via the same registry) on `MobileToolBar.tsx`.

**3. Icon** — `packages/excalidraw/components/icons.tsx`

New `LassoIcon` SVG matching the existing icon style (line + dotted loop).

**4. Command palette** — alongside `actionToggleEraserTool`

New `actionToggleLassoTool`: `name: "toggleLassoTool"`, `paletteName: "Lasso tool"`. Perform sets `appState.activeTool = { type: "lasso", ... }`. Registering it in the actions list surfaces it in the palette automatically.

**5. Keyboard shortcut: Ctrl+Alt hold-to-toggle**

Two pieces in App.tsx's keyboard handlers:

- **keydown:** if `event[KEYS.CTRL_OR_CMD] && event.altKey` (with no character key pressed), and the active tool isn't already lasso, store the current tool on `appState.activeTool.lastActiveTool` and switch to lasso.
- **keyup:** if either modifier is released and the active tool is lasso, restore `lastActiveTool`.

Same hold-to-toggle pattern the eraser uses for E.

**6. Cursor**

Crosshair when `activeTool.type === "lasso"`. Set in the existing `setCursorForShape` switch.

## Edge cases

- **< 3 points** (single click / tap): no-op, `selectionFromPath()` returns `{}`.
- **Self-intersecting path** (figure-8): non-zero winding handles it correctly.
- **Element entirely covered by another:** no special handling, depth doesn't affect lasso math.
- **Locked elements:** excluded via `!el.locked` candidate filter.
- **Elements behind frames:** unaffected — same visibility rules as `app.visibleElements`.

## Testing

`packages/excalidraw/tests/lasso.test.tsx` — the file the CI auto-runs. Use `render(<Excalidraw />)` and the existing `Pointer` / `fireEvent` helpers from `tests/test-utils.ts`. Set elements via `h.elements`, set tool via `h.setState({ activeTool })`, drive a pointer sequence, assert `h.state.selectedElementIds`.

12 behavior tests:

| # | Scenario | What it proves |
|---|----------|---------------|
| 1 | Lasso fully encloses one rectangle | Enclosure |
| 2 | Lasso crosses through one rectangle's edge | Intersection |
| 3 | Lasso entirely inside a large filled rectangle | Inside-fillable shortcut |
| 4 | Lasso encloses one of two rectangles | Negative case |
| 5 | Lasso with < 3 points | No-op |
| 6 | Released without manual closure but elements enclosed by implicit closing segment | Auto-close |
| 7 | Shift+drag with existing selection | Additive |
| 8 | Lasso encloses text bound to a container | Container also selected |
| 9 | Lasso encloses one member of a group | Whole group selected |
| 10 | Lasso encloses a frame | Frame selected as a unit |
| 11 | Locked element inside lasso | Not selected |
| 12 | Thin diagonal arrow crossed by lasso path | Tolerance branch (`lineSegmentsDistance`) |

No separate `lasso/utils.test.ts` — behavior tests cover helpers transitively, matching the codebase pattern (eraser geometry has no dedicated unit tests either).

## Hard gates

The challenge CI caps total at 30/100 if the build breaks or existing tests regress. The risk surface:

- `TOOL_TYPE` addition cascades into exhaustive `switch` statements. Each one needs a `case "lasso":` (usually a single line falling through to an existing default).
- `ActiveTool["type"]` consumers that pattern-match on the literal `"laser" | "eraser" | ...` union — same fix.

The implementation plan should grep for these sites first and fix them as part of the foundation step, before adding the runtime behavior.

## Out of scope (revisit later if requested)

- Polygonal point-by-point lasso.
- Lasso-aware copy/paste UI affordance.
- Performance benchmarking on canvases with thousands of elements (the AABB pre-filter is the main mitigation; benchmarking is a follow-up).
