# DodoStream Performance Troubleshooting Guide

This document catalogs known performance issues, prioritized fixes, and a debugging setup guide for TV and mobile platforms.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Priority 1 — Replace FlashList with Legend List + Eliminate Nested Virtualization](#priority-1--replace-flashlist-with-legend-list--eliminate-nested-virtualization)
3. [Priority 2 — Reduce Focusable Re-renders](#priority-2--reduce-focusable-re-renders)
4. [Priority 3 — Stabilize renderItem References](#priority-3--stabilize-renderitem-references)
5. [Priority 4 — Strip Debug Logging from Production](#priority-4--strip-debug-logging-from-production)
6. [Priority 5 — Remove Image Tracking Overhead](#priority-5--remove-image-tracking-overhead)
7. [Priority 6 — Extract useTheme from List Items](#priority-6--extract-usetheme-from-list-items)
8. [MCP Debugging Setup Guide](#mcp-debugging-setup-guide)
9. [Performance Profiling Workflow](#performance-profiling-workflow) — the full build → deploy → profile → fix loop
10. [Nuclear Options (If Still Not Enough)](#nuclear-options-if-still-not-enough)

---

## Architecture Overview

The home screen uses a **nested virtualized list pattern**:

- **Outer list** (vertical FlashList): Renders section headers, continue-watching rows, and catalog rows.
- **Inner lists** (horizontal FlashList per row): Each catalog section and the continue-watching row is its own FlashList.

With 8 addon catalogs, that's **~10 FlashList instances** mounted simultaneously—each with its own recycling pool, scroll handler, layout manager, and viewability tracking. On TV, every `Focusable` in every mounted inner list is a native `Pressable` with focus/blur handlers, creating hundreds of focusable nodes for the TV focus engine.

### Player Controls

`PlayerControls` is a ~600-line component with 20+ `useCallback` wrappers. The `currentTime` prop updates at ~4Hz from the player engine, causing cascading re-render checks. The `useTVEventHandler` fires on every D-pad press globally.

---

## Priority 1 — Replace FlashList with Legend List + Eliminate Nested Virtualization ✅ DONE

**Status: COMPLETED** — All FlashList usages have been migrated to LegendList (`@legendapp/list`). The `@shopify/flash-list` dependency has been removed.

**Impact: HIGH | Effort: MEDIUM-HIGH**

The core performance problem is N+1 nested virtualized lists. With 8 addon catalogs, that's ~10 list instances each with their own recycling pool, scroll handler, and layout manager.

Rather than prescribing one approach, we benchmark multiple options on a real TV device and pick the winner based on measured FPS, CPU, and memory.

### Option A: Legend List (outer) + ScrollView (inner)

**Hypothesis:** Inner rows don't need virtualization (10–50 lightweight cards each). A plain `ScrollView` has zero overhead — no recycling pool, no layout manager, no viewability tracking. The outer list controls which rows are mounted.

```
┌─────────────────────────────────────────┐
│ LegendList (vertical, single instance)  │
│  ├── SectionHeader                      │
│  ├── ScrollView (horizontal)            │
│  │    ├── MediaCard  MediaCard  ...     │
│  ├── SectionHeader                      │
│  ├── ScrollView (horizontal)            │
│  │    ├── MediaCard  MediaCard  ...     │
│  └── ...                                │
└─────────────────────────────────────────┘
```

**Pros:**

- Eliminates ALL nested list overhead — one virtualized list total
- Simplest code, easiest to debug
- No recycling state management needed for inner cards
- Plain `key` prop works normally (no FlashList/Legend List recycling concerns)

**Cons:**

- If a catalog has 100+ items, all cards mount at once in the ScrollView (though outer list unmounts the whole row when off-screen)
- No item-level recycling within a row — may matter on low-memory devices
- Horizontal scroll position is lost when row is unmounted/remounted by outer list

**Implementation:**

```tsx
// Inner row (MediaList.tsx)
import { ScrollView } from 'react-native';

<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  nestedScrollEnabled
  contentContainerStyle={{
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    gap: theme.spacing.m,
  }}>
  {data.map((item) => (
    <MediaCard key={item.id} media={item} onPress={onMediaPress} />
  ))}
</ScrollView>;
```

---

### Option B: Legend List (outer) + Legend List (inner)

**Hypothesis:** Legend List nested inside Legend List. Inner lists use `recycleItems` and `getFixedItemSize` for zero-measure recycling. Legend List may handle nesting better than FlashList due to lower per-instance overhead.

```
┌─────────────────────────────────────────┐
│ LegendList (vertical)                   │
│  ├── SectionHeader                      │
│  ├── LegendList (horizontal)            │
│  │    ├── MediaCard  MediaCard  ...     │
│  ├── SectionHeader                      │
│  ├── LegendList (horizontal)            │
│  │    ├── MediaCard  MediaCard  ...     │
│  └── ...                                │
└─────────────────────────────────────────┘
```

**Pros:**

- Recycling within rows — only visible cards are mounted (good for 100+ item catalogs)
- `getFixedItemSize` skips all measuring (card sizes are constant from theme)
- `keyExtractor` layout caching across data changes
- Legend List claims lower CPU/memory than FlashList per instance

**Cons:**

- Still N+1 list instances (one per visible row + outer)
- Each inner list still has its own scroll handler and layout tracking
- Need `useRecyclingState` in Focusable for focus state management

**Implementation:**

```tsx
// Inner row (MediaList.tsx)
import { LegendList } from '@legendapp/list';

<LegendList
  horizontal
  data={data}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  recycleItems
  getFixedItemSize={() => theme.cardSizes.media.width + theme.spacing.m}
  drawDistance={isTV ? TV_HORIZONTAL_DRAW_DISTANCE : MOBILE_HORIZONTAL_DRAW_DISTANCE}
  waitForInitialLayout={false}
  ItemSeparatorComponent={HorizontalSpacer}
  contentContainerStyle={{
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
  }}
/>;
```

---

### Option C: Legend List (outer) + FlashList (inner) — Keep Current Inner Lists

**Hypothesis:** Only replace the outer list with Legend List. Keep FlashList for the inner horizontal rows (smallest change surface). Tests whether the outer list is the bottleneck.

```
┌─────────────────────────────────────────┐
│ LegendList (vertical)                   │
│  ├── SectionHeader                      │
│  ├── FlashList (horizontal) — existing  │
│  │    ├── MediaCard  MediaCard  ...     │
│  ├── SectionHeader                      │
│  ├── FlashList (horizontal) — existing  │
│  │    ├── MediaCard  MediaCard  ...     │
│  └── ...                                │
└─────────────────────────────────────────┘
```

**Pros:**

- Smallest migration effort — only outer list changes
- Inner rows keep existing FlashList recycling/focus behavior
- Good as a control: isolates whether outer vs. inner list is the bottleneck

**Cons:**

- Still has FlashList instances per visible row with full overhead
- Mixed dependencies (both libraries)
- Doesn't solve nested list overhead if inner lists are the problem

**Implementation:**

```tsx
// Outer list (index.tsx) — swap import, keep inner rows as-is
import { LegendList } from '@legendapp/list';

<LegendList<HomeListItem>
  data={listData}
  renderItem={renderItem}
  keyExtractor={(item) => `${item.kind}-${item.sectionKey}`}
  drawDistance={Platform.isTV ? TV_DRAW_DISTANCE : MOBILE_DRAW_DISTANCE}
  getEstimatedItemSize={(item) => {
    switch (item.kind) {
      case 'section-header':
        return 50;
      case 'continue-watching-row':
        return theme.cardSizes.continueWatching.height + theme.spacing.s * 2;
      case 'catalog-row':
        return theme.cardSizes.media.height + theme.spacing.s * 2;
    }
  }}
  recycleItems={false}
/>;
// Inner FlashLists unchanged
```

---

### Option D: Single Legend List — Flattened Sections (No Nesting)

**Hypothesis:** Eliminate nesting entirely by flattening all data into one list. Each media card becomes a row. Use visual grouping (headers + horizontal layout via `numColumns` or manual row chunking) instead of nested lists. This is the most radical change.

```
┌─────────────────────────────────────────┐
│ LegendList (vertical, flat)             │
│  ├── SectionHeader "Trending"           │
│  ├── Row: [Card] [Card] [Card] [Card]  │
│  ├── Row: [Card] [Card] [Card]         │
│  ├── SectionHeader "Popular"            │
│  ├── Row: [Card] [Card] [Card] [Card]  │
│  └── ...                                │
└─────────────────────────────────────────┘
```

**Pros:**

- Single list instance — absolute minimum overhead
- All cards virtualized in one pool
- No nesting at all — no scroll-within-scroll interactions
- Focus navigation is simpler (one list's focus domain)

**Cons:**

- Loses horizontal scrolling within rows (rows are now vertical or grid-based)
- Fundamentally different UX — changes the home screen feel
- Harder to implement "see all" horizontal scroll for a category
- May need a completely different card layout

**Note:** This changes the visual design. Only viable if horizontal scrolling per category isn't a hard requirement.

---

### Benchmark Plan

#### Setup

1. Install Legend List alongside FlashList (temporary dual dependency):

   ```bash
   pnpx expo install @legendapp/list
   ```

2. Create a feature flag or dev-menu toggle to switch between options at runtime:

   ```tsx
   // src/store/developer.store.ts or similar
   homeListMode: 'A' | 'B' | 'C' | 'D'; // default: 'C' (current behavior baseline)
   ```

3. Build a **release** (not dev) build for Android TV:
   ```bash
   pnpm android --variant release
   # or: eas build --profile production_tv --local
   ```

#### Test Script

Perform the same interaction for each option:

1. Launch app → navigate to home screen
2. Wait 3 seconds (initial render settles)
3. Scroll down through all catalog rows (steady speed, ~2 rows/second)
4. Scroll back to top
5. Scroll down fast (flick gesture / hold D-pad down)
6. Total duration: ~30 seconds per option

#### Metrics to Capture

| Metric                     | Tool                      | Target             |
| -------------------------- | ------------------------- | ------------------ |
| UI Thread FPS (sustained)  | Flashlight / Perf Monitor | ≥55 fps            |
| JS Thread FPS (sustained)  | Flashlight / Perf Monitor | ≥55 fps            |
| Total CPU % during scroll  | Flashlight                | <50%               |
| Peak memory during scroll  | Flashlight                | Stable (no growth) |
| Frame drops (30s window)   | Perfetto                  | <10                |
| Time-to-interactive (home) | manual / onLoad callback  | <1.5s              |

#### Decision Matrix

| Option                           | UI FPS | JS FPS | CPU%   | Memory | Effort | Winner? |
| -------------------------------- | ------ | ------ | ------ | ------ | ------ | ------- |
| Baseline (FlashList > FlashList) | \_\_\_ | \_\_\_ | \_\_\_ | \_\_\_ | 0      | —       |
| A: LegendList > ScrollView       | \_\_\_ | \_\_\_ | \_\_\_ | \_\_\_ | Medium |         |
| B: LegendList > LegendList       | \_\_\_ | \_\_\_ | \_\_\_ | \_\_\_ | Medium |         |
| C: LegendList > FlashList        | \_\_\_ | \_\_\_ | \_\_\_ | \_\_\_ | Low    |         |
| D: LegendList flat               | \_\_\_ | \_\_\_ | \_\_\_ | \_\_\_ | High   |         |

Fill in measured values. Pick the option with the best FPS/CPU tradeoff for acceptable effort. If A and B are close, prefer A (simpler).

---

### Post-Benchmark: Full Migration

Once the winning option is chosen, fully migrate:

#### Install / Remove Dependencies

```bash
pnpx expo install @legendapp/list
# After full migration:
pnpm remove @shopify/flash-list
```

**Note:** `useRecyclingState` from FlashList is used in `Focusable.tsx`. Replace it with Legend List's `useRecyclingState` (same API) or remove it if inner rows use plain ScrollViews (Option A).

#### Clean Up Dead FlashList Code

- **`overrideItemLayout` callback** in `index.tsx` — sets `layout.size` which is dead in FlashList v2 (`layout.size` no longer read, only `layout.span`), and Legend List doesn't use it. Remove entirely.
- **`getItemType` callback** — Legend List doesn't use type-based recycling pools. Remove.
- **Perf debug scaffolding** (remove after profiling):
  - `renderItemRecreationCount` tracking
  - `prevActionsRef` + `continueWatchingActions` stability tracking
  - `prevRenderItemRef` tracking
  - `handleOuterListLoad` / `handleCWListLoad` — gate behind `__DEV__` or remove.
- **`useRecyclingState` in `Focusable.tsx`** — simplify to plain `useState` if Option A wins.

#### Migrate All Other FlashList Usages

| File                                                | Usage          | Notes                          |
| --------------------------------------------------- | -------------- | ------------------------------ |
| `src/app/(app)/(tabs)/library.tsx`                  | Vertical list  | Direct replacement             |
| `src/app/(app)/(tabs)/search.tsx`                   | Search results | Direct replacement             |
| `src/app/(app)/catalog.tsx`                         | Catalog grid   | Use Legend List + `numColumns` |
| `src/components/media/EpisodeList.tsx`              | Episode list   | Direct replacement             |
| `src/components/media/StreamList.tsx`               | Stream list    | Direct replacement             |
| `src/components/media/TrailersTab.tsx`              | Trailer list   | Direct replacement             |
| `src/components/media/CastTab.tsx`                  | Cast list      | Direct replacement             |
| `src/components/basic/PickerModal.tsx`              | Picker items   | Direct replacement             |
| `src/components/settings/AddonsSettingsContent.tsx` | Addon list     | Direct replacement             |
| `src/components/video/SubtitlePickerModal.tsx`      | Subtitle list  | Direct replacement             |

#### Legend List Configuration Tips

From the [Legend List Performance docs](https://legendapp.com/open-source/list/v3/performance/):

- **`keyExtractor`** — Always provide. Allows Legend List to reuse layout info across data changes.
- **`getEstimatedItemSize`** — Provide per-item estimates. More accurate = less layout shifting. Slightly underestimate rather than overestimate.
- **`getFixedItemSize`** — Use when items have known fixed sizes (skips all measuring).
- **`recycleItems`** — Enable for lists where items have no local state (e.g., episode lists, stream lists). Disable for heterogeneous outer lists.
- **`drawDistance`** — Keep current TV/mobile values. Experiment with lower values if items are expensive to render.
- **`waitForInitialLayout`** — Set to `false` for fixed-size items to avoid a 1-frame delay.

---

## Priority 2 — Reduce Focusable Re-renders ✅ DONE

**Status: COMPLETED** — Focusable now uses Pressable's native `style={({focused}) => ...}` function for non-render-function children, eliminating React state updates and re-renders on focus/blur. Only render-function children still use `useState`.

**Impact: HIGH | Effort: MEDIUM**

**File:** `src/components/basic/Focusable.tsx`

> **Note:** This is independent of the Legend List migration and can be done in parallel.

Every focus/blur event triggers `setState` in the `Focusable` component, causing a React re-render even when children don't need `isFocused`. On TV, D-pad navigation fires focus/blur at high frequency — 2 re-renders per step across all visible items.

### Suggested Fix: Use Pressable's Built-in Style Function

For `variant="outline"` and `variant="background"` (non-render-function children), avoid React state entirely by using `Pressable`'s native `style` function:

```tsx
// Instead of tracking isFocused in useState and recomputing style:
<Pressable
  style={({ focused }) => [
    flatStyle,
    focused ? computeFocusStyle(true, variant, theme, focusedStyle) : undefined,
  ]}>
  {children}
</Pressable>
```

This moves focus styling to the native layer — no JS re-renders on focus change. Only keep `useState` for the render-function children path (`typeof children === 'function'`).

### Caveat

Verify that `Pressable`'s `style` function receives `focused` in react-native-tvos. If not available, consider using `onFocus`/`onBlur` with `setNativeProps` or Reanimated shared values to bypass React state.

---

## Priority 3 — Stabilize renderItem References ✅ DONE

**Status: COMPLETED** — All `renderItem` callbacks in list components are now wrapped in `useCallback` with proper dependency arrays.

**Impact: MEDIUM | Effort: LOW**

Legend List benefits from stable references, and plain `ScrollView` rows with `.map()` benefit from stable callbacks passed to children.

### Files with inline `renderItem` (no useCallback)

After the Priority 1 migration, `MediaList.tsx` and `ContinueWatchingSectionRow` become plain `ScrollView` + `.map()` — no `renderItem` prop needed. The remaining files still use Legend List and should have stable `renderItem`:

| File                                                | Line | Component      |
| --------------------------------------------------- | ---- | -------------- |
| `src/components/media/TrailersTab.tsx`              | ~50  | TrailerCard    |
| `src/components/media/EpisodeList.tsx`              | ~126 | EpisodeItem    |
| `src/components/media/StreamList.tsx`               | ~224 | StreamListItem |
| `src/components/settings/AddonsSettingsContent.tsx` | ~132 | AddonCard      |

### Fix

Wrap each `renderItem` in `useCallback`:

```tsx
// Before
renderItem={({ item, index }) => (
  <MediaCard media={item} onPress={onMediaPress} ... />
)}

// After
const renderItem = useCallback(
  ({ item, index }: { item: MetaPreview; index: number }) => (
    <MediaCard media={item} onPress={onMediaPress} ... />
  ),
  [onMediaPress]
);

// ...
<FlashList renderItem={renderItem} ... />
```

### Files already correct (no change needed)

- `src/components/media/CastTab.tsx` — useCallback ✓
- `src/components/basic/PickerModal.tsx` — useCallback ✓
- `src/app/(app)/(tabs)/index.tsx` (outer list) — useCallback ✓

---

## Priority 4 — Strip Debug Logging from Production ✅ DONE

**Status: COMPLETED** — `debug.ts` is gated on `__DEV__`. `babel-plugin-transform-remove-console` added for production builds as a safety net.

**Impact: MEDIUM | Effort: LOW**

### Problem

`src/utils/debug.ts` runs `console.debug()` when `isSentryEnabled` is true — which is likely true in production. React Native docs explicitly warn that `console.*` is a major performance bottleneck.

### Fix Option A: Gate on `__DEV__` only

```tsx
// src/utils/debug.ts
export const createDebugLogger = (scope: string): DebugLogger => {
  return (...args: unknown[]) => {
    if (__DEV__) {
      console.debug(`[${scope}]`, ...args);
    }
  };
};
```

### Fix Option B: Add babel-plugin-transform-remove-console

```bash
pnpm add -D babel-plugin-transform-remove-console
```

Then update `babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  let plugins = [];
  plugins.push('react-native-worklets/plugin');
  if (process.env.NODE_ENV === 'production') {
    plugins.push('transform-remove-console');
  }
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
```

**Recommendation:** Do both. Option A is the narrowest fix; Option B is a safety net that catches third-party console calls too.

---

## Priority 5 — Remove Image Tracking Overhead ✅ DONE

**Status: COMPLETED** — No image tracking code exists in the codebase.

**Impact: LOW-MEDIUM | Effort: LOW**

**File:** `src/components/media/MediaCard.tsx` (lines ~20–81)

Every MediaCard instance runs a `useEffect` to track image mount/unmount in a global `Set`. This is perf-debugging code that adds overhead in every card.

### Fix

Gate behind `__DEV__`:

```tsx
// Only track in development
if (__DEV__) {
  useEffect(() => {
    if (imageUri) trackImageMount(imageUri);
    return () => {
      if (imageUri) trackImageUnmount(imageUri);
    };
  }, [imageUri]);
}
```

Or remove entirely once image loading performance is satisfactory.

---

## Priority 6 — Extract useTheme from List Items (DEFERRED)

**Status: DEFERRED** — `useTheme()` is just `useContext()` which is very cheap per call. The theme can change dynamically (scaling + presets), so a static import isn't possible. Threading theme props through 6+ callers creates significant churn for marginal gain. Profile on device before investing here.

**Impact: LOW | Effort: LOW**

**Files affected:**

- `src/components/media/MediaCard.tsx` — calls `useTheme<Theme>()` per card instance
- `src/components/media/ContinueWatchingCard.tsx` — calls `useTheme<Theme>()` per card instance
- `src/components/media/CatalogSectionHeader.tsx` — calls `useTheme<Theme>()` per header

### Fix

Extract theme values at the parent list level and pass them as props:

```tsx
// In MediaList.tsx (parent)
const theme = useTheme<Theme>();
const cardWidth = theme.cardSizes.media.width;
const cardHeight = theme.cardSizes.media.height;

// Pass to MediaCard
<MediaCard cardWidth={cardWidth} cardHeight={cardHeight} ... />
```

This eliminates context subscription overhead from hundreds of list items. The theme rarely changes, so the values can be passed as stable props.

**Note:** This may be marginal. Profile before and after to confirm impact.

---

## MCP Debugging Setup Guide

MCP (Model Context Protocol) servers enable AI agents to interact with devices, network traces, and profiling tools directly during debugging sessions.

### 1. Remote ADB for Android TV

Connect to your Android TV over the network so all tools (Flashlight, Systrace, logcat) work from your dev machine:

```bash
# On Android TV: Settings → Developer options → Enable "ADB over network"
# Note the IP address shown

# From dev machine:
adb connect <android-tv-ip>:5555
adb devices  # Verify connection
```

Once connected, all ADB-based tools work as if the device were USB-connected.

### 2. Flashlight — Performance Measurement

[Flashlight](https://docs.flashlight.dev/) measures FPS, CPU usage, memory, and thread utilization on real Android devices. Generates HTML reports with flamegraphs.

```bash
# Install (macOS/Linux)
curl https://get.flashlight.dev | bash

# On Apple Silicon, also install Rosetta if needed:
softwareupdate --install-rosetta --agree-to-license

# Basic measurement (plug in device or use remote ADB):
flashlight measure

# Automated test with scripted scenarios:
flashlight test --config flashlight.yaml
```

**Recommended workflow:**

1. Connect to Android TV via remote ADB
2. Run `flashlight measure`
3. Perform the laggy scrolling interaction on the home screen
4. Stop measurement → get HTML report
5. Share report with agent for analysis

### 3. mobile-mcp — Agent-Controlled Device Interaction

The `mobile-mcp` MCP server (already configured in this workspace) can interact with Android/iOS devices:

- Take screenshots
- Tap/swipe at coordinates
- List UI elements
- Type text

**Setup for Android TV:**

1. Ensure ADB is connected (step 1 above)
2. The MCP server auto-detects connected devices
3. Agent can take screenshots, navigate, and capture state during profiling

### 4. Limelight MCP — Runtime Diagnostics

The `limelight` MCP server (already configured) provides:

- Component render profiling
- Error investigation
- State snapshot inspection
- Network query analysis
- Timeline correlation

**Usage:** Ask the agent to use Limelight to investigate specific components or errors.

### 5. React DevTools Profiler

```bash
# Start standalone React DevTools
npx react-devtools

# In your app's dev menu, connect to the dev server
# Use the Profiler tab to:
# - Record interactions
# - See component render times
# - Identify "why did this render?" for each component
# - View flame chart of component tree
```

Works with remote devices as long as they can reach the dev server on the same network.

### 6. Perfetto / Systrace (Android)

For native-level thread analysis (UI thread frame drops, JS thread blocking):

```bash
# Record a 10-second trace on connected Android TV:
adb shell perfetto -o /data/misc/perfetto-traces/trace.pb \
  -t 10s sched freq idle am wm gfx view

# Pull and analyze:
adb pull /data/misc/perfetto-traces/trace.pb
# Open at https://ui.perfetto.dev
```

### 7. React Native Perf Monitor

Built into the dev menu — shows JS and UI thread FPS in real time:

```bash
# Open dev menu on Android TV:
adb shell input keyevent 82

# Then select "Show Perf Monitor"
```

### 8. Agent-Assisted Debugging Workflow

For the most productive debugging loop with an AI agent:

1. **Connect** Android TV via remote ADB (`adb connect <ip>:5555`)
2. **Measure** with Flashlight while reproducing the lag
3. **Capture** logcat during the interaction: `adb logcat -d > logcat.txt`
4. **Profile** with React DevTools Profiler (record a session, export JSON)
5. **Share** all artifacts with the agent:
   - Flashlight HTML report
   - logcat output
   - React DevTools profiler JSON
   - Perfetto trace (if needed)
6. Agent analyzes and proposes targeted fixes
7. **Re-measure** after applying fixes to confirm improvement

---

## Performance Profiling Workflow

### Why Release Builds Are Required

**You cannot profile performance in the Expo dev client.** Dev mode adds:

- React DevTools instrumentation (~2× slower renders)
- LogBox / error overlay interception
- Fast Refresh (Metro HMR) polling
- Hermes debug mode (unoptimized bytecode)
- `__DEV__` branches enabling extra logging, warnings, and Sentry debug output

All of these add overhead that masks the real bottlenecks. Performance numbers from dev mode are meaningless.

The Expo Perf Monitor (`Cmd+P` / dev menu → "Show Perf Monitor") works in dev builds and gives a rough FPS reading, but the absolute numbers are not representative of production. Use it only for quick relative comparisons between code changes, never for final benchmarks.

### End-to-End Workflow: Build → Deploy → Profile → Fix → Repeat

#### Step 0: Prerequisites (One-Time Setup)

```bash
# 1. Install Flashlight (macOS)
curl https://get.flashlight.dev | bash
# On Apple Silicon, also:
softwareupdate --install-rosetta --agree-to-license

# 2. Enable Developer Options on Android TV
#    Settings → About → click "Build Number" 7 times
#    Settings → Developer Options → enable:
#      - USB debugging
#      - ADB over network (note the IP:port shown, e.g. 192.168.1.100:5555)

# 3. Connect ADB to the TV from your dev machine
adb connect 192.168.1.100:5555
adb devices   # Should show the TV as "device"
```

#### Step 1: Make Code Changes

Edit source files as normal. No need to run Metro or the dev client.

#### Step 2: Build a Release APK for TV (Local)

Use the EAS local build to produce a signed release APK targeting TV:

```bash
# Production TV APK (release, optimized, EXPO_TV=1):
pnpm build:production_apk:tv:local
# → Outputs: build-*.apk in project root
```

This runs `eas build --profile production_tv_apk --local`, which:

- Sets `APP_VARIANT=prod` and `EXPO_TV=1`
- Builds an APK (not AAB) so you can sideload it
- Uses the production Gradle config (ProGuard/R8, Hermes bytecode compilation)

**Alternative — faster iterative builds** if you've already prebuilt:

```bash
# Direct Gradle release build (faster, skips EAS overhead):
cd android && ./gradlew :app:assembleRelease && cd ..
# → Outputs: android/app/build/outputs/apk/release/app-release.apk
```

> **Note:** The direct Gradle build doesn't set `EXPO_TV=1` env var. For TV-specific code paths, use the EAS build. For general perf testing (list scrolling, etc.) the Gradle build is fine and significantly faster (~2-3 min vs ~8-10 min).

#### Step 3: Install the APK on the TV

```bash
# Find the APK (EAS local build output):
ls -la build-*.apk

# Or Gradle output:
ls -la android/app/build/outputs/apk/release/app-release.apk

# Install on the connected TV (replaces existing install):
adb install -r <path-to-apk>

# If package conflict (dev vs prod variant), uninstall first:
adb uninstall app.dodora.dodostream
adb install <path-to-apk>
```

#### Step 4: Launch the App on the TV

```bash
# Launch the app:
adb shell am start -n app.dodora.dodostream/.MainActivity

# Or if you need to cold start (kill first):
adb shell am force-stop app.dodora.dodostream
adb shell am start -n app.dodora.dodostream/.MainActivity
```

#### Step 5: Profile with Flashlight

```bash
# Start Flashlight measurement (auto-detects ADB device):
flashlight measure

# Flashlight will:
# 1. Prompt you to select the connected device
# 2. Ask for the app package name: app.dodora.dodostream
# 3. Start recording FPS, CPU, memory, thread utilization
#
# NOW: Perform the test interaction on the TV
# (e.g., scroll through home screen for 30 seconds)
#
# 4. Press Ctrl+C to stop
# 5. Opens an HTML report in your browser
```

**Test script** (perform consistently for each comparison):

1. Wait 3 seconds after home screen loads (initial render settles)
2. Scroll down through all catalog rows (steady speed, ~2 rows/sec)
3. Scroll back to top
4. Scroll down fast (hold D-pad down for 5 seconds)
5. Total: ~30 seconds

#### Step 6: Capture Additional Diagnostics (Optional)

```bash
# Logcat — capture JS errors, debug logs, native crashes:
adb logcat -d > logcat_$(date +%Y%m%d_%H%M%S).txt

# Perfetto trace — native thread analysis (UI thread stalls, JS thread blocking):
adb shell perfetto -o /data/misc/perfetto-traces/trace.pb \
  -t 10s sched freq idle am wm gfx view
adb pull /data/misc/perfetto-traces/trace.pb
# Open at https://ui.perfetto.dev

# Memory snapshot:
adb shell dumpsys meminfo app.dodora.dodostream
```

#### Step 7: Analyze Results → Fix → Repeat

1. Open the Flashlight HTML report
2. Look for:
   - **JS FPS drops** → JS thread is blocked (component re-renders, heavy computation)
   - **UI FPS drops** → native thread is blocked (layout, image decoding, focus engine)
   - **CPU spikes during scroll** → too many components mounting/unmounting
   - **Memory growth** → components or closures not being cleaned up
3. Make targeted code changes based on findings
4. **Go back to Step 2** — build, deploy, profile again
5. Compare Flashlight reports side-by-side (save each HTML report with a descriptive name)

### Quick Reference: The Full Loop

```
┌─────────────────────────────────────────────────────┐
│  Edit code                                          │
│     ↓                                               │
│  pnpm build:production_apk:tv:local                 │
│     ↓                                               │
│  adb install -r build-*.apk                         │
│     ↓                                               │
│  adb shell am start -n                              │
│    app.dodora.dodostream/.MainActivity               │
│     ↓                                               │
│  flashlight measure                                 │
│     ↓                                               │
│  Perform test interaction on TV (30s)               │
│     ↓                                               │
│  Ctrl+C → review HTML report                        │
│     ↓                                               │
│  Compare with previous report → decide next change  │
│     ↓                                               │
│  Repeat from top                                    │
└─────────────────────────────────────────────────────┘
```

### Profiling Checklist

- [ ] ADB connected to production TV device (`adb devices` shows it)
- [ ] Release APK built and installed (not dev client)
- [ ] Flashlight installed and working (`flashlight --version`)
- [ ] Baseline measurement taken (current code, before changes)
- [ ] Test interaction scripted (same steps every time for fair comparison)
- [ ] Flashlight reports saved with descriptive names (e.g., `flashlight_baseline.html`, `flashlight_option_a.html`)

### Key Metrics to Track

| Metric                        | Target             | Tool                     |
| ----------------------------- | ------------------ | ------------------------ |
| UI Thread FPS                 | ≥55 fps sustained  | Flashlight, Perf Monitor |
| JS Thread FPS                 | ≥55 fps sustained  | Flashlight, Perf Monitor |
| Total CPU % during scroll     | <50%               | Flashlight               |
| Memory during scroll          | Stable (no growth) | Flashlight               |
| Frame drop count (10s scroll) | <5 dropped         | Perfetto                 |

### Apple TV Profiling

For tvOS profiling, the workflow is different since Flashlight/ADB don't apply:

1. **Build for Apple TV:**

   ```bash
   pnpm build:production:tv:local
   # Or: npx expo run:ios --configuration Release --device
   ```

2. **Profile with Xcode Instruments:**
   - Open Instruments → choose "Time Profiler" or "Core Animation" template
   - Select the Apple TV device
   - Record while performing the test interaction
   - Analyze the flame chart for main thread stalls

3. **MetricKit** (passive): If integrated, collects hang reports and scroll hitch metrics automatically from real usage.

---

## Nuclear Options (If Still Not Enough)

If performance remains unacceptable after all the above changes, these are the escalation paths:

### Option A: React Native Skia for Card Rendering

Use `@shopify/react-native-skia` to render media cards as canvas elements, bypassing the React component tree for card rendering entirely. Each card becomes a single Skia drawing call instead of a deep tree of `View` > `Image` > `Text` > `Pressable` nodes.

### Option B: Native Grid Modules

Write the home screen grid as a native Android TV `Leanback` BrowseSupportFragment / tvOS `UICollectionView` and embed via a native module. The native TV frameworks are purpose-built for this exact use case (horizontal rows in a vertical list) and handle focus routing entirely in the UI thread.

### Option C: Evaluate if react-native-tvos is the right choice

React Native TVOS apps _can_ be performant, but the constraints are real:

- **Focus engine is JS-driven** — every focus change crosses the native bridge.
- **No native recycling for horizontal rows** — unlike Android TV's native RecyclerView.
- **Pressable focus/blur events are chatty** — high-frequency D-pad navigation creates lots of bridge traffic.

If the app's primary target is TV and the home screen is the core experience, a native TV implementation may ultimately be the right call. This is a last resort after exhausting all optimization paths above.
