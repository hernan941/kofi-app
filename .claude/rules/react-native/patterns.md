---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# React Native / Expo Patterns

> Do NOT apply web/DOM patterns here (e.g. URL-as-state, `window`, `document`).

## Navigation (Expo Router)

- Keep route files (`src/app/**`) thin — they wire params + hooks to a screen component that lives in `features/`.
- Type route params; validate untrusted params (e.g. from deep links) with a schema before use.
- Use typed navigation helpers (`useLocalSearchParams`, `Link`, `router.push`).
- Centralize linking config; never trust deep-link params without validation.

The example below uses `safeParse`, not `parse`: a malformed deep link would otherwise throw during render and crash the screen. It redirects instead of throwing.

```tsx
import { useLocalSearchParams, router } from 'expo-router'
import { z } from 'zod'

const Params = z.object({ id: z.uuid() })

/**
 * Route `src/app/sale/[id].tsx`: validates the id and renders the sale detail.
 */
export default function SaleScreen() {
  const parsed = Params.safeParse(useLocalSearchParams())
  if (!parsed.success) {
    router.replace('/not-found')
    return null
  }
  return <SaleDetail saleId={parsed.data.id} />
}
```

## State Management

Keep these concerns separate and do not duplicate server data into client stores. The tools listed are common choices, not decisions — the actual choice is recorded in an ADR.

| Concern | Common choices |
|---------|---------|
| Server state | a server-cache library (TanStack Query, SWR) |
| Client/UI state | a lightweight store (Zustand, Jotai) or Context |
| Navigation/route state | Expo Router params (NOT a global store) |
| Form state | a form library (e.g. React Hook Form) with schema validation |
| Secure persistence | `expo-secure-store` |
| Non-secure persistence | SQLite / MMKV / `AsyncStorage` (small values only) |

- Derive values instead of storing redundant computed state.
- Keep global client state minimal; prefer local `useState` until sharing is actually needed.
- When reading from a store, select the narrowest slice so unrelated changes do not re-render the component.

## Data Fetching

Use a server-cache library instead of ad-hoc fetch-in-`useEffect`.

- Route server reads through the cache and mutations through it, with cache invalidation.
- Validate API responses with a schema at the boundary; infer types from the schema.
- Handle the three states explicitly in UI: loading, error, empty.
- Use optimistic updates for fast interactions: snapshot, apply, roll back on failure with visible feedback. Does not apply to local SQLite data in this project: ADR-009 forbids optimistic updates there, because local writes and invalidation are immediate.
- Fetch independent data in parallel; avoid request waterfalls between parent and child.

```tsx
/**
 * Loads a sale by id through the server cache, validating the response.
 */
function useSale(id: string) {
  return useQuery({
    queryKey: ['sale', id],
    queryFn: async () => saleSchema.parse(await api.getSale(id)),
  })
}
```

## Lists

- Use `FlatList`/`SectionList` (or `FlashList` for large/heavy lists) — never `.map()` a large array inside a `ScrollView`.
- Provide a stable `keyExtractor` (a real id, never the array index); memoize `renderItem`.
- Paginate or virtualize long data sets.

## Custom Hooks

- Extract reusable logic (data, permissions, device APIs) into `use*` hooks.
- Keep side effects (Expo SDK calls, subscriptions) inside hooks, not in JSX.

## Async & Effects

- Clean up subscriptions, timers, and listeners in the effect's return function (see performance.md › Memory Leaks).
- Cancel or ignore stale async results on unmount to avoid setState-after-unmount.
