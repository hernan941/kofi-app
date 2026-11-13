---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# React Native / Expo Coding Style

## Components

- Define props with a named `interface` or `type`; do not use `React.FC`.
- Keep screens thin: a screen composes hooks + presentational components, it does not hold heavy logic.
- One component per file for anything reusable; co-locate small private subcomponents.
- Prefer function components and hooks. No class components.
- Document exported components and hooks with a TSDoc docstring; never inline comments (ADR-003).

```tsx
interface AvatarProps {
  uri: string
  size?: number
  onPress?: () => void
}

/**
 * Circular user avatar. Pressable only when `onPress` is provided.
 */
export function Avatar({ uri, size = 40, onPress }: AvatarProps) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    </Pressable>
  )
}
```

## Styling

The project uses **HeroUI Native + Uniwind (Tailwind v4)** (ADR-004). Style with `className`; use `style` only for values that are truly dynamic (computed sizes, animated values).

- Never hardcode raw colors, spacing, or font sizes. Everything comes from the design-system tokens (`docs/design-system.md`).
- Extract repeated class strings into shared constants or a variant helper.
- Do not build style objects inline on hot paths (list rows, frequently re-rendered components): they allocate on every render. If a static `style` object is needed, define it at module scope.

Wrong: hardcoded values and an inline object recreated every render.

```tsx
<View style={{ padding: 16, backgroundColor: '#fff' }} />
```

Correct: design-system tokens through classes.

```tsx
<View className="p-4 bg-background" />
```

## Platform Differences

The app targets **both iOS and Android**; every UI change must be checked on both.

- Use platform-specific files (`Component.ios.tsx`, `Component.android.tsx`) for substantial divergence.
- Use `Platform.select()` / `Platform.OS` for small differences only.
- Account for safe areas with `react-native-safe-area-context`; do not hardcode status bar / notch offsets.
- Handle the Android hardware back button in modals and multi-step flows.
- Keyboard behavior differs per platform: verify forms with the keyboard open on both.

## Imports & Project Layout

- Use the Expo/TS path alias (e.g. `@/components/...`) instead of long relative chains.
- Organize by feature/domain, not by type. Keep files focused (200-400 lines typical, 800 max).

## Logging

- No `console.log` in shipped code. Use a logger and strip logs in production builds.
- Surface user-facing errors through UI state, not console.

## TypeScript

- `strict` mode, explicit types on public APIs, no `any` without a documented reason (ADR-001).
- Prefer immutable updates; never mutate props or state.
- Validate untrusted external data with a schema library at the boundary (choice recorded in an ADR).
