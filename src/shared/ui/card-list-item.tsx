import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ListSeparator } from './list-row';

const SIDE_CLASSES = 'border-x-2 border-border bg-surface px-4';

/** Props of {@link CardListItem}. */
export interface CardListItemProps {
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly children: ReactNode;
}

/** Classes that round the first and last row so all of them look like one card. */
function rowClasses(isFirst: boolean, isLast: boolean): string {
  return [
    SIDE_CLASSES,
    isFirst ? 'rounded-t-3xl border-t-2' : '',
    isLast ? 'rounded-b-3xl border-b-2' : '',
  ].join(' ');
}

/**
 * Wrapper of a row of a `FlatList` whose rows look like one card (design system 6.2): side
 * borders on every row, rounded top and top border on the first, rounded bottom and bottom
 * border on the last. It is decorative: it adds no role or label.
 */
export function CardListItem({ isFirst, isLast, children }: CardListItemProps) {
  return (
    <View testID="card-list-item" className={rowClasses(isFirst, isLast)}>
      {children}
    </View>
  );
}

/** Separator between the rows of a {@link CardListItem} list, drawn inside the card borders. */
export function CardListSeparator() {
  return (
    <View testID="card-list-separator" className={SIDE_CLASSES}>
      <ListSeparator />
    </View>
  );
}
