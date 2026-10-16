# Graph Report - focus-guardian  (2026-08-19)

## Corpus Check
- 25 files · ~9,384 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 189 nodes · 269 edges · 14 communities (12 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `useFocusStore` - 12 edges
3. `scripts` - 9 edges
4. `useFocusGuardian()` - 9 edges
5. `files` - 8 edges
6. `build` - 7 edges
7. `mac` - 7 edges
8. `fmtDuration()` - 7 edges
9. `render()` - 6 edges
10. `takeBreak()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `createWindow()` --calls--> `registerAiHandlers()`  [EXTRACTED]
  main.js → electron/ipc/ai.ipc.js
- `createWindow()` --calls--> `registerFocusHandlers()`  [EXTRACTED]
  main.js → electron/ipc/focus.ipc.js
- `App()` --calls--> `useFocusGuardian()`  [EXTRACTED]
  src/App.tsx → src/features/focus/useFocusGuardian.ts
- `Header()` --calls--> `useFocusStore`  [EXTRACTED]
  src/ui/Header.tsx → src/store/focus.store.ts
- `App()` --calls--> `useFocusStore`  [EXTRACTED]
  src/App.tsx → src/store/focus.store.ts

## Import Cycles
- None detected.

## Communities (14 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (20): App(), FocusPanel(), focusScore(), TIME_BOXES, NudgeOverlay(), PillView(), takeBreak(), Props (+12 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (16): configPath(), readConfig(), registerAiHandlers(), writeConfig(), registerFocusHandlers(), checkAutomation(), hasAccessibility(), registerPermHandlers() (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (20): build, appId, asar, directories, files, mac, productName, buildResources (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (19): concurrently, electron, electron-builder, devDependencies, concurrently, electron, electron-builder, @types/react (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (9): groq-sdk, dependencies, groq-sdk, react, react-dom, zustand, react, react-dom (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.32
Nodes (5): Toast, ToastKind, ToastsState, useToastsStore, Toasts()

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (10): chunk(), clamp01(), cov(), crc32(), CRC_TABLE, __dirname, lerp(), outPath (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (16): author, description, main, name, private, scripts, build, dev (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.36
Nodes (7): chunk(), crc32(), CRC_TABLE, __dirname, edge(), outDir, renderTarget()

### Community 10 - "Community 10"
Cohesion: 0.23
Nodes (14): allowDriftingApp(), elapsedToLevel(), endDrift(), overlayForLevel(), returnToTask(), scheduleReturn(), useFocusGuardian(), activityKey() (+6 more)

## Knowledge Gaps
- **89 isolated node(s):** `__dirname`, `MIME`, `NORMAL`, `PILL`, `name` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `build` connect `Community 3` to `Community 8`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Why does `files` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `electron/**/*` connect `Community 2` to `Community 3`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `__dirname`, `MIME`, `NORMAL` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14039408866995073 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._