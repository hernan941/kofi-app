---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# React Native / Expo Checks

Recommended checks to keep RN/Expo code healthy. Adapt commands to the package manager.

## After editing *.ts / *.tsx

- **Type check:** `tsc --noEmit` — catch type errors early.
- **Lint:** `npx expo lint` (uses `eslint-config-expo`; flat config `eslint.config.js`).
- **Format:** `prettier --write` on changed files.

## Pre-release / periodic

- `npx expo-doctor` — validates Expo/native dependency health and config.
- `npx expo install --check` — keeps native deps aligned with the installed Expo SDK.
- `npm audit` — dependency vulnerability scan.

## Notes

- Do not run heavy native builds in fast edit-time checks; keep them to typecheck/lint/format.
- Reserve `eas build` and E2E for the end of the feature or explicit commands (ADR-002), not per-edit automation.
