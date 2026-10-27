# AGENTS.md — WME Speed Limits Shortcuts (SLS)

Guidelines and architectural context for AI coding agents working on `wme-speedlimit-shortcuts`.

## Project Overview
Userscript for the Waze Map Editor (WME) that registers keyboard shortcuts (`Alt+0..9` and `Alt+Shift+0..5`) to quickly set or remove speed limits (km/h) on selected road segments, and automatically cleans up invalid opposite-direction speed limits on one-way segments.

---

## Critical Rules & Constraints

1. **WME SDK Mode (`AsyncWmeSDK`):**
   - Always use the **asynchronous `AsyncWmeSDK`** interface (`import { AsyncWmeSDK } from "wme-sdk-typings"`), initialized with `mode: "async"`.
   - Always pass `mode: "async"` to `getWmeSdk`. Under `AsyncWmeSDK`, SDK calls (`DataModel`, `Editing`, `Map`, `Settings`, `Shortcuts`, `LayerSwitcher`, `Sidebar`, `Events.trackDataModelEvents`) return `Promise`s and must be `await`ed (note: `Events.on` / `Events.off`, `getSDKVersion()`, and `getWMEVersion()` remain synchronous).
2. **SDK Documentation & Typings:**
   - Refer to `https://www.waze.com/editor/sdk/` (production) and `https://beta.waze.com/editor/sdk/` (beta).
   - Import types from `wme-sdk-typings` (e.g., `AsyncWmeSDK`, `Segment`).
   - Userscript metadata uses `@grant none`, so `window.SDK_INITIALIZED` and `window.getWmeSdk` are accessed directly on `window`.
3. **Zero Legacy Globals (`W`, `OpenLayers`, `I18n`, `WazeWrap`):**
   - Never use deprecated or legacy WME globals (`W`, `W.model`, `W.map`, `W.selectionManager`, `OpenLayers`, `I18n`, `WazeWrap`). All interactions with segments, selections, user settings, shortcuts, and editor events must exclusively use the official WME SDK (`wmeSDK`).

---

## SDK Bootstrap Pattern (`AsyncWmeSDK`)

Target pattern for [`main.user.ts`](./main.user.ts):

```typescript
import { AsyncWmeSDK } from "wme-sdk-typings";

window.SDK_INITIALIZED.then(initScript);

async function initScript(): Promise<void> {
  if (!window.getWmeSdk) {
    throw new Error("SDK not available");
  }
  const wmeSDK: AsyncWmeSDK = window.getWmeSdk({
    scriptId: "wme-speedlimits-shortcuts",
    scriptName: "WME SL Shortcuts",
    mode: "async",
  });

  // Initialize shortcuts and event listeners...
}
```

---

## Project Structure & Responsibilities

- [`main.user.ts`](./main.user.ts): Single-file entry point containing all script logic:
  - **Keyboard Shortcuts Registration:** Registers `Alt+0..9` (`A+0` to `A+9` for removing or setting `10..90` km/h) and `Alt+Shift+0..5` (`AS+0` to `AS+5` for `100..150` km/h) via `wmeSDK.Shortcuts.createShortcut`.
  - **Speed Limit Updates (`setSpeedQuick`, `setSpeedByID`, `setSpeed`):** Verifies metric units via `wmeSDK.Settings.getUserSettings()`, checks segment directionality (`isAtoB`, `isBtoA`, `isTwoWay`), and updates `fwdSpeedLimit` and `revSpeedLimit` via `wmeSDK.DataModel.Segments.updateSegment`.
  - **One-Way Segment Speed Limit Cleanup (`fixAllSegments` & `wme-selection-changed`):** Automatically clears invalid speed limits on the non-drivable direction of one-way segments when segments are selected (`wme-selection-changed`) or when map data loads (`wme-map-data-loaded`, processed in batches with an `AbortController` and circular SVG progress indicator up to `maxEdits`).
- [`header.js`](./header.js) & [`header-dev.js`](./header-dev.js): Tampermonkey userscript headers. `header-dev.js` includes a local `@require` pointing to `.out/main.user.js` for local development.
- [`rollup.config.mjs`](./rollup.config.mjs): Rollup configuration that compiles TypeScript (`main.user.ts`) into an IIFE bundle at `.out/main.user.js`.

---

## WME SDK Usage Patterns

1. **Segments (`wmeSDK.DataModel.Segments`):**
   - Querying: `getAll()`, `getById({ segmentId })`, `isRoadTypeDrivable({ roadType })`.
   - Updating: `updateSegment({ segmentId, fwdSpeedLimit, revSpeedLimit })` (pass `null` to remove a speed limit).
2. **Editing & Selection (`wmeSDK.Editing`):**
   - Selection: `getSelection()` (check `selectedFeatures?.objectType === "segment"` and iterate `selectedFeatures.ids`).
   - Editor state: `isEditingAllowed()`, `isSnapshotModeOn()`, `getUnsavedChangesCount()`.
3. **Settings & Shortcuts (`wmeSDK.Settings`, `wmeSDK.Shortcuts`):**
   - Settings: `getUserSettings()` (check `isImperial`).
   - Shortcuts: `createShortcut({ shortcutId, shortcutKeys, description, callback })`.
4. **Events (`wmeSDK.Events`):**
   - Note the parameter name is `eventHandler` (not `callback`):
     ```typescript
     wmeSDK.Events.on({ eventName: "wme-map-data-loaded", eventHandler: fn });
     wmeSDK.Events.on({ eventName: "wme-selection-changed", eventHandler: fn });
     ```

---

## Debugging & Build Commands

- **Debug Logging (`console.debug`):**
  - Use `console.debug(...)` for diagnostic output. In production builds (`NODE_ENV=production`), `@rollup/plugin-strip` automatically removes `console.debug`, `log.debug`, and `debugger` statements.
- **Commands ([`package.json`](./package.json)):**
  - `npm run compile`: Build development bundle (`rollup -c`) into `.out/main.user.js` (unminified, preserves `console.debug`).
  - `npm run watch`: Rollup watch mode for iterative development.
  - `npm run concat`: Concatenate [`header.js`](./header.js) and `.out/main.user.js` into `releases/`.
  - `npm run build`: Full development build (`compile` + `concat`).
  - `npm run release`: Sync version from [`package.json`](./package.json) into [`header.js`](./header.js), build production bundle (`NODE_ENV=production`, strips debug logs, minifies via Terser), and concatenate into `releases/`.
