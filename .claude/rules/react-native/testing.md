---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# React Native / Expo Testing

> Workflow defined in ADR-002: TDD (red → green → refactor) during the feature; E2E and heavy tests only at the end of the feature.

## Tooling

| Layer | Tool |
|-------|------|
| Unit / component | Jest + `@testing-library/react-native` (via `jest-expo` preset) |
| Hooks | `@testing-library/react-native` `renderHook` |
| E2E (end of feature) | Maestro |
| Type safety | `tsc --noEmit` |

## Component Tests

- Query by accessible role/label/text, not by `testID` unless necessary — this also enforces accessibility.
- Assert on user-visible behavior, not implementation details.
- Follow Arrange-Act-Assert.

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'

test('calls onSelect with the sale id when pressed', () => {
  const onSelect = jest.fn()
  render(<SaleRow sale={{ id: '1', amount: 1500 }} onSelect={onSelect} />)

  fireEvent.press(screen.getByRole('button', { name: /1\.500/ }))

  expect(onSelect).toHaveBeenCalledWith('1')
})
```

## Mocking

- Mock Expo SDK modules (camera, location, notifications, secure-store) at the test boundary.
- Wrap components that use a server-cache library in its provider with a fresh client per test.
- Mock navigation (`expo-router`) so screens render in isolation.
- Test effect cleanup: unmount the component/hook and assert subscriptions were removed and timers cleared.

## E2E

- Written and run at the end of the feature, once logic and UI are stable.
- Cover critical flows only: primary navigation and core transactions.
- Run on both iOS and Android.
