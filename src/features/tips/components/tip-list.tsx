import { SectionList, Text, View } from 'react-native';

import { Card, CheckIcon, ListRow, ListSeparator } from '@/shared/ui';

import type { TipCategory, TipId, TipListItem, TipSection } from '../domain';
import { TIP_CATEGORY_LABELS } from './category-labels';

/** Props of {@link TipList}. */
export interface TipListProps {
  readonly sections: readonly TipSection[];
  readonly onOpenTip: (id: TipId) => void;
}

/** Una categoría y su tarjeta: la lista nativa recibe un solo elemento por sección. */
interface CategoryBlock {
  readonly key: TipCategory;
  readonly category: TipCategory;
  readonly data: readonly TipSection[];
}

/** Celdas de la lista nativa por categoría: encabezado, tarjeta y pie. */
const CELLS_PER_CATEGORY = 3;

/** Etiqueta accesible de una fila: "{título}, {categoría}" y ", visto" si ya se vio. */
function rowLabel({ tip, seen }: TipListItem): string {
  const base = `${tip.title}, ${TIP_CATEGORY_LABELS[tip.category]}`;
  return seen ? `${base}, visto` : base;
}

/**
 * Consejos por categoría (3.3): un encabezado por categoría y una tarjeta con sus filas. Los
 * vistos dicen "Visto" con el ícono `Check`; los demás no llevan marca. Se anuncia "visto" en la
 * etiqueta accesible, así que no depende del color ni del ícono. Son pocas categorías, así que
 * se dibujan todas desde el principio.
 */
export function TipList({ sections, onOpenTip }: TipListProps) {
  const blocks: readonly CategoryBlock[] = sections.map((section) => ({
    key: section.category,
    category: section.category,
    data: [section],
  }));
  return (
    <SectionList
      sections={blocks}
      initialNumToRender={blocks.length * CELLS_PER_CATEGORY}
      keyExtractor={(section) => section.category}
      contentContainerClassName="px-4 pb-6"
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text
          accessibilityRole="header"
          className="pt-6 pb-2 font-semibold text-heading text-foreground"
        >
          {TIP_CATEGORY_LABELS[section.category]}
        </Text>
      )}
      renderItem={({ item: { items } }) => (
        <Card>
          <View>
            {items.map((item, index) => (
              <View key={item.tip.id}>
                {index === 0 ? null : <ListSeparator />}
                <ListRow
                  title={item.tip.title}
                  subtitle={item.seen ? 'Visto' : undefined}
                  subtitleIcon={item.seen ? CheckIcon : undefined}
                  accessibilityLabel={rowLabel(item)}
                  accessibilityHint="Abre el consejo"
                  onPress={() => {
                    onOpenTip(item.tip.id);
                  }}
                />
              </View>
            ))}
          </View>
        </Card>
      )}
    />
  );
}
