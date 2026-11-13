---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# React Native / Expo Performance

## Rendering

- If the React Compiler is enabled in the project, do not add `React.memo` / `useCallback` / `useMemo` by hand unless a measurement shows it is needed. Without the compiler, memoize only where it prevents real re-renders.
- Keep component state local and narrow — lifting state too high re-renders large subtrees.
- Avoid creating new objects/arrays/functions inline in props on hot paths; they break memoization.
- Split large screens so a state change re-renders the smallest possible subtree.
- Split Context by concern: one value that changes often in a big Context re-renders every consumer.

## Lists

- Use `FlatList`/`SectionList`, or `FlashList` (Shopify) for large or heterogeneous lists.
- Provide `keyExtractor`, a memoized `renderItem` defined outside the JSX, and stable item heights when possible (`getItemLayout`).
- Tune `initialNumToRender`, `windowSize`, `maxToRenderPerBatch` for heavy rows.
- Never render large data sets with `.map()` inside a `ScrollView`.
- Never nest a virtualized list inside a `ScrollView` with the same orientation.

## Memory Leaks

Every resource acquired in an effect is released in its cleanup. Typical leaks:

- **Listeners and subscriptions** (`AppState`, `Keyboard`, `Linking`, `Dimensions`, event emitters, store subscriptions, sensors, location): keep the returned subscription and call `.remove()` / unsubscribe in the cleanup.
- **Timers**: `clearTimeout` / `clearInterval` in the cleanup.
- **Async work**: abort `fetch` with an `AbortController` (or ignore the result with a flag) when the component unmounts or the dependency changes.
- **Animations**: cancel running Reanimated animations (`cancelAnimation`) when unmounting.
- **Screens that stay mounted**: in a stack, previous screens are not unmounted. Start/stop focus-only work (polling, sensors, camera) with `useFocusEffect`, not `useEffect`.
- **Closures holding large data**: do not keep big arrays or images in module-level variables, global stores or caches without a size limit.

```tsx
/**
 * Re-syncs the data when the app returns to the foreground.
 */
function useSyncOnForeground(sync: () => void) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync()
    })
    return () => subscription.remove()
  }, [sync])
}
```

## Images & Assets

- Use `expo-image` for caching, priority, and placeholders; serve appropriately sized images.
- Avoid loading full-resolution images into small thumbnails; avoid large base64 strings in state.

## Animations

- Prefer `react-native-reanimated` (runs on the UI thread) over the JS-driven `Animated` API.
- For legacy `Animated`, set `useNativeDriver: true` where supported.
- Never drive an animation with `setState` per frame.
- Keep heavy computation off the JS thread; offload to Reanimated worklets or native modules.

## Data & Storage

- Do not load whole tables into memory: paginate queries and add indexes for the columns you filter or sort by.
- `AsyncStorage` is for small values only; it is not a database.

## Runtime & Build

- Build on the **New Architecture** (Fabric + TurboModules), mandatory from Expo SDK 55+. Verify every native dependency is New-Arch compatible before adding it.
- Ensure **Hermes** is enabled (default in modern Expo) for faster startup and lower memory.
- Defer non-critical work after first paint; lazy-load heavy screens/modules.
- Do not use `InteractionManager` (deprecated); defer low-priority work with `requestIdleCallback` or after the animation/transition finishes.
- Android low-end devices are the baseline: check performance there, not only on a recent iPhone.

## Measuring

- Profile with the React DevTools profiler, the Hermes sampling profiler, and the in-app performance monitor. (Avoid Flipper — deprecated and not supported on the New Architecture.)
- Watch for: long lists without virtualization, oversized images, frequent full-tree re-renders, memory that keeps growing after navigating back and forth, and synchronous work on the JS thread.
