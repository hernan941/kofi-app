import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import {
  activeVersions,
  versionNameKey,
  type Product,
  type ProductVersion,
} from '@/features/products/domain';
import type { Clp } from '@/shared/domain';
import {
  Card,
  CaretLeftIcon,
  ListRow,
  ListSeparator,
  Sheet,
  TextButton,
  TextField,
} from '@/shared/ui';

import { ProductThumbnail, coverPhotoIdOf } from '@/features/products';

const SEARCH_MIN_PRODUCTS = 10;
const INLINE_PRODUCTS_MAX = 20;
const SHEET_INITIAL_ROWS = 12;
const SHEET_WINDOW_SIZE = 5;

/** Props of {@link ProductPicker}. */
export interface ProductPickerProps {
  readonly products: readonly Product[];
  readonly showThumbnails: boolean;
  readonly onSelect: (product: Product) => void;
}

/** Precios fijos de las versiones. */
function fixedPrices(versions: readonly ProductVersion[]): readonly Clp[] {
  return versions.flatMap((version) =>
    version.pricing.mode === 'fixed' ? [version.pricing.price] : [],
  );
}

/** Menor de los precios, o `undefined` si no hay ninguno. */
function lowestPrice(prices: readonly Clp[]): Clp | undefined {
  return prices.reduce<Clp | undefined>(
    (lowest, price) => (lowest === undefined || price < lowest ? price : lowest),
    undefined,
  );
}

/** Fila de un producto: la misma tabla que la lista de productos, para reconocer las filas. */
function ProductRow({
  product,
  showThumbnails,
  onSelect,
}: {
  readonly product: Product;
  readonly showThumbnails: boolean;
  readonly onSelect: ProductPickerProps['onSelect'];
}) {
  const versions = activeVersions(product);
  const lowest = lowestPrice(fixedPrices(versions));
  const isSingle = versions.length === 1;
  const count = `${String(versions.length)} versiones`;
  const leading = showThumbnails ? (
    <ProductThumbnail coverPhotoId={coverPhotoIdOf(product)} />
  ) : undefined;
  const press = () => {
    onSelect(product);
  };
  if (isSingle && lowest === undefined) {
    return (
      <ListRow
        leading={leading}
        title={product.name}
        subtitle="A convenir"
        accessibilityLabel={`${product.name}, precio a convenir`}
        onPress={press}
      />
    );
  }
  if (isSingle) {
    return <ListRow leading={leading} title={product.name} amount={lowest} onPress={press} />;
  }
  if (lowest === undefined) {
    return (
      <ListRow
        leading={leading}
        title={product.name}
        subtitle={`${count} · a convenir`}
        accessibilityLabel={`${product.name}, ${count}, precio a convenir`}
        onPress={press}
      />
    );
  }
  return (
    <ListRow
      leading={leading}
      title={product.name}
      subtitle={count}
      amount={lowest}
      amountPrefix="desde"
      onPress={press}
    />
  );
}

/** Productos cuyo nombre contiene el texto, sin distinguir mayúsculas ni tildes (D-31). */
function filterByName(products: readonly Product[], query: string): readonly Product[] {
  const key = versionNameKey(query);
  return key === '' ? products : products.filter((p) => versionNameKey(p.name).includes(key));
}

/** Búsqueda por nombre: el buscador solo aparece desde `SEARCH_MIN_PRODUCTS` productos. */
function useProductSearch(products: readonly Product[]) {
  const [query, setQuery] = useState('');
  const hasSearch = products.length >= SEARCH_MIN_PRODUCTS;
  const matches = hasSearch ? filterByName(products, query) : products;
  return { query, setQuery, hasSearch, matches };
}

/** Campo de búsqueda de productos. */
function SearchField({
  query,
  onChange,
}: {
  readonly query: string;
  readonly onChange: (query: string) => void;
}) {
  return (
    <TextField
      label="Buscar producto"
      value={query}
      onChangeText={onChange}
      placeholder="Nombre del producto"
      autoCapitalize="none"
      returnKeyType="search"
    />
  );
}

/** Aviso de que ningún producto coincide con la búsqueda. */
function NoMatches({ query }: { readonly query: string }) {
  return (
    <Text className="text-base text-muted">{`No encontramos productos con "${query.trim()}".`}</Text>
  );
}

/**
 * Lista de productos vendibles para elegir (3.2), pensada para ir dentro de un `ScrollView`:
 * una fila por producto con la información de la lista de productos, limitada a los primeros
 * `INLINE_PRODUCTS_MAX` (no anida una lista virtualizada). Con 10 productos o más suma un
 * buscador por nombre que recorre todos. Solo avisa cuál se tocó; qué versión y cómo se agrega
 * lo decide quien la usa.
 */
export function ProductPicker({ products, showThumbnails, onSelect }: ProductPickerProps) {
  const { query, setQuery, hasSearch, matches } = useProductSearch(products);
  const visible = matches.slice(0, INLINE_PRODUCTS_MAX);
  return (
    <View className="gap-3">
      {hasSearch ? <SearchField query={query} onChange={setQuery} /> : null}
      {matches.length === 0 ? (
        <NoMatches query={query} />
      ) : (
        visible.map((product, index) => (
          <View key={product.id}>
            {index > 0 ? <ListSeparator /> : null}
            <ProductRow product={product} showThumbnails={showThumbnails} onSelect={onSelect} />
          </View>
        ))
      )}
      {matches.length > visible.length ? (
        <Text className="text-sm text-muted">
          {`Mostrando ${String(visible.length)} de ${String(matches.length)} productos. Busca por nombre para encontrar el resto.`}
        </Text>
      ) : null}
    </View>
  );
}

/** Clave estable de una fila de la lista de la hoja. */
function productKey(product: Product): string {
  return product.id;
}

/**
 * Lista de productos de la hoja: virtualizada con `FlatList` (pocas filas iniciales y ventana
 * acotada) y con el buscador fuera de la lista, para que no se pierda el foco al filtrar.
 */
function VirtualizedProductList({ products, showThumbnails, onSelect }: ProductPickerProps) {
  const { query, setQuery, hasSearch, matches } = useProductSearch(products);
  const renderItem = ({ item }: { readonly item: Product }) => (
    <ProductRow product={item} showThumbnails={showThumbnails} onSelect={onSelect} />
  );
  return (
    <View className="gap-3">
      {hasSearch ? <SearchField query={query} onChange={setQuery} /> : null}
      {matches.length === 0 ? (
        <NoMatches query={query} />
      ) : (
        <FlatList
          className="max-h-96"
          data={matches}
          renderItem={renderItem}
          keyExtractor={productKey}
          ItemSeparatorComponent={ListSeparator}
          initialNumToRender={SHEET_INITIAL_ROWS}
          windowSize={SHEET_WINDOW_SIZE}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

/** Props of {@link VersionStep}. */
interface VersionStepProps {
  readonly product: Product;
  readonly onPick: (version: ProductVersion) => void;
}

/** Paso de versión: las versiones activas del producto, en su orden. */
function VersionStep({ product, onPick }: VersionStepProps) {
  return (
    <Card>
      {activeVersions(product).map((version, index) => {
        const name = version.name ?? product.name;
        return (
          <View key={version.id}>
            {index > 0 ? <ListSeparator /> : null}
            {version.pricing.mode === 'fixed' ? (
              <ListRow
                title={name}
                amount={version.pricing.price}
                onPress={() => {
                  onPick(version);
                }}
              />
            ) : (
              <ListRow
                title={name}
                subtitle="A convenir"
                accessibilityLabel={`${name}, precio a convenir`}
                onPress={() => {
                  onPick(version);
                }}
              />
            )}
          </View>
        );
      })}
    </Card>
  );
}

/** Props of {@link ProductPickerSheet}. */
export interface ProductPickerSheetProps {
  readonly isOpen: boolean;
  readonly products: readonly Product[];
  /** Producto cuyo paso de versión se abre directo (sin volver a la lista), por ejemplo desde "Cambiar". */
  readonly initialProduct?: Product;
  readonly showThumbnails: boolean;
  readonly onPick: (product: Product, version: ProductVersion) => void;
  readonly onClose: () => void;
}

/**
 * Hoja para agregar un producto (3.4): la lista de productos y, si el elegido tiene varias
 * versiones, el paso de versión dentro de la misma hoja. Con `initialProduct` abre directo en
 * el paso de versión (desde "Cambiar" o al tocar un producto con varias versiones en la lista
 * de la pantalla). Un producto de una sola versión se elige sin pasar por el paso de versión.
 */
export function ProductPickerSheet({
  isOpen,
  products,
  initialProduct,
  showThumbnails,
  onPick,
  onClose,
}: ProductPickerSheetProps) {
  const [chosen, setChosen] = useState<Product | undefined>(initialProduct);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setChosen(initialProduct);
  }

  const select = (product: Product) => {
    const [only, ...others] = activeVersions(product);
    if (only !== undefined && others.length === 0) {
      onPick(product, only);
      return;
    }
    setChosen(product);
  };

  return (
    <Sheet
      isOpen={isOpen}
      title={chosen === undefined ? '¿Qué más vendiste?' : `¿Qué versión de ${chosen.name}?`}
      onClose={onClose}
      focusKey={chosen === undefined ? 'list' : 'versions'}
      isScrollable={chosen !== undefined}
    >
      {chosen === undefined ? (
        <VirtualizedProductList
          products={products}
          showThumbnails={showThumbnails}
          onSelect={select}
        />
      ) : (
        <View className="gap-3">
          {initialProduct === undefined ? (
            <View className="items-start">
              <TextButton
                label="Ver todos los productos"
                icon={CaretLeftIcon}
                onPress={() => {
                  setChosen(undefined);
                }}
              />
            </View>
          ) : null}
          <VersionStep
            product={chosen}
            onPick={(version) => {
              onPick(chosen, version);
            }}
          />
        </View>
      )}
    </Sheet>
  );
}
