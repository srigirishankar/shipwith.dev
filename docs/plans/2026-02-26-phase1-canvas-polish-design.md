# Phase 1 Design: Canvas Polish + Properties Panel

> **Date:** 2026-02-26
> **Status:** Approved
> **Scope:** Phase 1a (foundation) + Phase 1b (polish)
> **Execution:** Two Ralph-Loop runs

---

## Context

shipwith.dev is a browser-based visual architecture builder (Canvas 2D, vanilla JS, zero deps). The current codebase has working drag-drop, 17 components with 22 typed ports, bezier wire connections, and 5 templates. Phase 1 makes the builder feel professional by adding node configuration, multi-layer rendering, and persistence.

Source documents:
- `PRD.md` (v2.0, 2026-02-25) — consolidated product spec
- `3xshipwithAnalysis225.md` — cross-repo comparison (shipwith wins)
- `paperdrawAnalysis.md` — competitive reverse engineering

---

## Design Decisions

### 1. Multi-layer canvas (moved early)

Replace the single `<canvas>` with 4 stacked canvases in a CSS grid container:

| Layer | Z-Index | Repaints When | Content |
|-------|---------|---------------|---------|
| grid | 0 | pan/zoom only | Dot grid background |
| edges | 1 | edge change or connected node moves | Bezier wire connections |
| nodes | 2 | node add/remove/move/select | Node rectangles with ports |
| overlay | 3 | every frame (requestAnimationFrame) | Selection box, wire preview, hover effects, alignment guides |

Each layer has a dirty flag. The render loop checks flags and only calls the relevant draw function. All canvases share the same pan/zoom transform.

**Why early:** This is the most invasive change, touching canvas.js deeply. Building features (properties panel, snap-to-grid, save/load) on top of the old single-canvas would require reworking them later.

### 2. Properties panel as DOM (push-resize)

Layout: `palette (240px) | canvas (flex-grow) | properties (320px, conditional)`

When a node is selected, the properties panel slides in from the right, shrinking the canvas. The canvas handles resize events and updates its dimensions.

Panel sections:
- **Header:** Icon + component name + role
- **Description:** Plain-English explanation from component spec
- **Configuration:** Form inputs for capacity (instances, maxRPS), scaling (auto/min/max), cost/hour, base latency
- **Provider:** Dropdown of alternatives from `metadata.alternatives`
- **Educational:** Expandable "When to use" / "Pitfalls" sections

All inputs update `node.config` and call `canvasState.notify()`.

**Why DOM:** Real form inputs, scrolling, accessibility, and styling come free. Canvas-rendered forms are painful.

### 3. Extended data model (pure JS)

Add `config` and `provider` objects to NodeSpec and EdgeSpec. No WASM in Phase 1 — metrics calculations will be pure JS when introduced in Phase 3.

```javascript
// NodeSpec additions
config: {
  capacity: { instances: 1, maxRPSPerInstance: 1000 },
  scaling: { autoScale: false, minInstances: 1, maxInstances: 10 },
  reliability: { failureProbability: 0.001, circuitBreaker: false },
  cost: { perHour: 0.05, currency: 'USD' },
  latency: { baseMs: 5, p95Multiplier: 1.8 },
}
provider: {
  id: 'cloudflare',
  name: 'Cloudflare',
  alternatives: ['aws', 'gcp', 'vercel']
}

// EdgeSpec additions
config: {
  protocol: 'HTTPS',
  sync: true,
  latencyMs: 1,
  retryPolicy: { maxRetries: 3, backoffMs: 100, backoffMultiplier: 2 },
  label: '',
}
```

Default values populated from component specs when `addNode()` is called. `toJSON()` serializes config/provider. New `fromJSON()` static method reconstructs state.

### 4. Test infrastructure (bun test)

Use Bun's built-in Jest-compatible test runner. Add `package.json` at project root with test script. Tests go in `www/tests/` with `.test.js` suffix.

Modules to test (80% coverage target):
- `component-specs.js` — type compatibility matrix, getComponentSpec, validateGraph
- `graph-model.js` — add/remove nodes/edges, serialization roundtrip
- `state.js` — screenToWorld, getNodeAt, selection, toJSON/fromJSON

The custom test harness in `www/tests/run-all.js` is for legacy modules and will be left as-is (not deleted, not extended).

### 5. Save/Load (localStorage)

Auto-save to localStorage on state change (debounced 500ms). Restore on app init via `fromJSON()`. Export button downloads JSON. Import button uses file picker. "New Canvas" clears everything.

Key: `shipwith:graph` in localStorage.

---

## Phase 1a — Foundation (Ralph-Loop Run 1)

### Task 1a.0: Cleanup Deprecated Files

**Actions:**
- Delete `www/scene.js` (3,855 LOC)
- Delete `www/components.js` (97 LOC)
- Delete `www/bottom-sheet.css`
- Delete `www/stack-state.js` (450 LOC)
- Delete `www/tests/stack-state.test.js`, `scene-data.test.js`, `scene-behavior.test.js`, `ui-behavior.test.js`, `responsive-redesign.test.js`, `run-all.js`
- Delete `www/features/` directory
- Delete `www/shared/` directory
- Delete `www/pkg/` directory (WASM package, not used in Phase 1)
- Verify `index.html` has no references to deleted files
- Commit all untracked active files: `canvas.js`, `state.js`, `palette.js`, `component-specs.js`

**Pass:** `rg "scene.js|components.js|stack-state|bottom-sheet" www/index.html` returns 0. App loads at localhost:8080 without errors.
**Fail:** References remain or app breaks.

### Task 1a.1: Multi-Layer Canvas

**Actions:**
- Replace single `<canvas id="canvas">` in index.html with a container div holding 4 canvases
- Refactor `canvas.js`:
  - Create 4 canvas contexts (grid, edges, nodes, overlay)
  - Add dirty flags: `gridDirty`, `edgesDirty`, `nodesDirty` (overlay always redraws)
  - `draw()` checks flags, calls layer-specific draw functions
  - All mouse/touch events attach to the top (overlay) canvas
  - All canvases share pan/zoom transform
  - Handle resize: all canvases resize together
- Update `style.css`: stack canvases with position:absolute in a relative container

**Pass:** Moving a node repaints nodes + edges layers only (not grid). Grid repaints only on pan/zoom. Wire preview renders on overlay. No visual artifacts. 60fps with 20 nodes.
**Fail:** All layers repaint every frame, or visual glitches from misalignment.

### Task 1a.2: Extended Data Model

**Actions:**
- Add `config` and `provider` properties to `NodeSpec` constructor in `graph-model.js`
- Add `config` property to `EdgeSpec` constructor
- Add default config values based on component spec in `state.js` `addNode()`
- Add default edge config in `addEdge()`
- Update `toJSON()` to include config and provider
- Add static `fromJSON(json)` to CanvasState that reconstructs graph from serialized data
- Ensure backward compatibility: `fromJSON()` handles old JSON without config gracefully

**Pass:** `canvasState.addNode('workers', 0, 0)` creates node with `config.capacity.instances === 1`. `toJSON()` includes config. `fromJSON(toJSON())` roundtrips correctly.
**Fail:** Config missing from serialization or fromJSON fails.

### Task 1a.3: Node Properties Panel

**Actions:**
- New file: `www/properties.js`
- Add `<aside id="properties-panel">` to `index.html`
- CSS: right-side slide-out, 320px wide, dark theme. Transition on open/close. Canvas container uses flex layout: `#palette | #canvas-container (flex:1) | #properties-panel`
- Panel opens when `selectedNodeIds.size === 1`, closes when 0 or >1
- Subscribe to canvasState for selection changes
- Sections: header (icon + name + role), description, config form inputs (capacity, scaling, cost, latency), provider dropdown, educational text
- Form inputs update `node.config` directly and call `canvasState.notify()`
- Canvas handles resize when panel opens/closes (listen for transitionend or ResizeObserver)

**Pass:** Click node → panel opens, canvas shrinks. Edit "instances" → `node.config.capacity.instances` updates. Click empty → panel closes. Mobile: panel is full-width overlay.
**Fail:** Panel doesn't open, or edits don't persist on node.

### Task 1a.4: Unit Tests

**Actions:**
- Add `package.json` at project root with `{ "scripts": { "test": "bun test" } }`
- New test files:
  - `www/tests/component-specs.test.js` — test all 22 type compatibilities, getComponentSpec, validateGraph
  - `www/tests/graph-model.test.js` — add/remove nodes/edges, serialization roundtrip with config
  - `www/tests/state.test.js` — screenToWorld, getNodeAt, selection, toJSON/fromJSON
- Target: 80%+ line coverage on `component-specs.js`, `graph-model.js`, `state.js`

**Pass:** `bun test` passes with 80%+ coverage.
**Fail:** Tests fail or coverage below 80%.

---

## Phase 1b — Polish (Ralph-Loop Run 2)

### Task 1b.0: Save/Load

**Actions:**
- Auto-save to `localStorage` key `shipwith:graph` on every state change (debounced 500ms)
- On app init, check localStorage and restore via `fromJSON()`
- Add toolbar with: Export (download JSON), Import (file picker), New Canvas (clear)
- Add toolbar UI to `index.html` (top-right buttons)

**Pass:** Create graph, reload → graph restored. Export → import → graph restored. New Canvas → empty.
**Fail:** Graph lost on reload.

### Task 1b.1: Snap-to-Grid

**Actions:**
- In node drag handler, round position to 40px grid
- `snapEnabled` flag (default true)
- Alt/Option held during drag disables snap
- Show faint crosshair on overlay canvas at snap target during drag

**Pass:** Drag to (123, 87) → snaps to (120, 80). Alt+drag → (123, 87) exact.
**Fail:** No snapping or Alt override broken.

### Task 1b.2: Edge Properties Panel

**Actions:**
- Extend properties panel to handle edge selection
- Show: source → target, port types, protocol dropdown, sync/async toggle, latency input, retry policy, label
- Edge label renders on canvas (centered on bezier midpoint)

**Pass:** Click edge → panel shows correct info. Set label → appears on wire.
**Fail:** Edge panel doesn't show or label doesn't render.

### Task 1b.3: Viewport Culling

**Actions:**
- In drawNodes(), compute viewport bounds in world coordinates
- Skip drawNode() if node AABB doesn't intersect viewport
- In drawEdges(), skip if both endpoints outside viewport (with margin)

**Pass:** With 50+ nodes, only visible ones draw. FPS improves when most nodes off-screen.
**Fail:** All nodes still draw regardless.

### Task 1b.4: Path2D Caching

**Actions:**
- Cache Path2D for node shapes on node object
- Invalidate on size change
- Cache bezier paths for edges, invalidate when endpoints move
- Use cached paths for fill, stroke, hit testing

**Pass:** Path2D created once per node (not per frame). isPointInPath works with cached paths.
**Fail:** Paths recreated every frame or hit testing breaks.

---

## Ralph-Loop Configuration

### Run 1 (Phase 1a)

```
/ralph-loop:ralph-loop "Read docs/plans/2026-02-26-phase1-canvas-polish-design.md and implement Phase 1a tasks (1a.0 through 1a.4) in order. Use bun test to verify after each task. Skip to next task if current passes. Output <promise>COMPLETE</promise> when all Phase 1a tasks pass." --max-iterations 20 --completion-promise "COMPLETE"
```

### Run 2 (Phase 1b)

```
/ralph-loop:ralph-loop "Read docs/plans/2026-02-26-phase1-canvas-polish-design.md and implement Phase 1b tasks (1b.0 through 1b.4) in order. Run bun test after each change. Output <promise>COMPLETE</promise> when all Phase 1b tasks pass." --max-iterations 15 --completion-promise "COMPLETE"
```

### Stuck Handling

If 3 iterations fail on the same task:
1. Report: blocking issue, attempts, likely root cause
2. Skip if blocker is isolated
3. Stop if blocker affects downstream tasks

### Completion Criteria

**Phase 1a:**
- Deprecated files deleted, no references remain
- 4-layer canvas rendering with dirty flags
- NodeSpec/EdgeSpec have config and provider objects
- Properties panel opens on node select, edits persist
- `bun test` passes with 80%+ coverage on core modules
- App loads at localhost:8080 without errors

**Phase 1b:**
- Graph persists across page reloads (localStorage)
- Snap-to-grid works, Alt disables
- Edge properties panel works, labels render
- Viewport culling active
- Path2D caching active

---

## Files Modified/Created

| File | Action | Phase |
|------|--------|-------|
| `www/scene.js` | Delete | 1a.0 |
| `www/components.js` | Delete | 1a.0 |
| `www/stack-state.js` | Delete | 1a.0 |
| `www/bottom-sheet.css` | Delete | 1a.0 |
| `www/tests/*.test.js` (legacy) | Delete | 1a.0 |
| `www/features/` | Delete | 1a.0 |
| `www/shared/` | Delete | 1a.0 |
| `www/pkg/` | Delete | 1a.0 |
| `www/index.html` | Modify | 1a.1, 1a.3 |
| `www/canvas.js` | Major refactor | 1a.1 |
| `www/style.css` | Modify | 1a.1, 1a.3 |
| `www/graph-model.js` | Modify | 1a.2 |
| `www/state.js` | Modify | 1a.2, 1a.3 |
| `www/properties.js` | Create | 1a.3 |
| `package.json` | Create | 1a.4 |
| `www/tests/component-specs.test.js` | Create | 1a.4 |
| `www/tests/graph-model.test.js` | Create | 1a.4 |
| `www/tests/state.test.js` | Create | 1a.4 |
