/** The part of the Expo Router `router` that {@link goBackOrHome} uses. */
export interface BackNavigator {
  canGoBack(): boolean;
  back(): void;
  replace(href: '/'): void;
}

/**
 * Goes back when there is history and, when the screen was opened without it (deep link,
 * reminder), replaces the stack with the start so the user is never left on a dead end.
 */
export function goBackOrHome(router: BackNavigator): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}
