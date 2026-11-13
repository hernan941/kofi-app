import { Text, View } from 'react-native';

import { formatClp, formatClpAccessible } from '@/shared/domain';
import { ArchiveIcon, Amount, Card, InlineNotice, ListRow, ListSeparator } from '@/shared/ui';
import { Fragment } from 'react';

import { activeVersions, type Product, type ProductVersion } from '../domain';
import { PhotoGallery } from './photo-gallery';

/** Props of {@link ProductDetail}. */
export interface ProductDetailProps {
  readonly product: Product;
}

/** Label of a version row, with the cost read in pesos. */
function versionLabel(version: ProductVersion): string {
  const name = version.name ?? 'Sin nombre';
  const price =
    version.pricing.mode === 'fixed'
      ? formatClpAccessible(version.pricing.price)
      : 'precio a convenir';
  const cost = version.cost === null ? [] : [`te cuesta ${formatClpAccessible(version.cost)}`];
  return [name, price, ...cost].join(', ');
}

/** Secondary line of a version row. */
function versionSubtitle(version: ProductVersion): string | undefined {
  const cost = version.cost === null ? undefined : formatClp(version.cost);
  if (version.pricing.mode === 'negotiable') {
    return cost === undefined ? 'A convenir' : `A convenir · te cuesta ${cost}`;
  }
  return cost === undefined ? undefined : `Te cuesta ${cost}`;
}

/** Price and cost of a product with a single version. */
function SinglePrice({ version }: { readonly version: ProductVersion }) {
  return (
    <View className="gap-1">
      <Text className="font-medium text-sm text-muted">Precio</Text>
      {version.pricing.mode === 'fixed' ? (
        <Amount value={version.pricing.price} variant="display" />
      ) : (
        <>
          <Text className="text-heading text-foreground">A convenir</Text>
          <Text className="text-sm text-muted">El precio lo escribes al registrar cada venta.</Text>
        </>
      )}
      {version.cost === null ? null : (
        <View className="flex-row items-center justify-between pt-2">
          <Text className="text-sm text-muted">Te cuesta hacerlo</Text>
          <Amount value={version.cost} variant="inline" />
        </View>
      )}
    </View>
  );
}

/** Card with a static row per active version. */
function VersionsCard({ versions }: { readonly versions: readonly ProductVersion[] }) {
  return (
    <Card title="Versiones">
      {versions.map((version, index) => (
        <Fragment key={version.id}>
          {index > 0 ? <ListSeparator /> : null}
          <ListRow
            title={version.name ?? 'Sin nombre'}
            subtitle={versionSubtitle(version)}
            amount={version.pricing.mode === 'fixed' ? version.pricing.price : undefined}
            accessibilityLabel={versionLabel(version)}
          />
        </Fragment>
      ))}
    </Card>
  );
}

/**
 * Content of the product detail (design 3.3 and 3.4), without the header or the fixed
 * buttons, which belong to the screen: archived note, description, price or versions.
 */
export function ProductDetail({ product }: ProductDetailProps) {
  const versions = activeVersions(product);
  const isArchived = product.archivedAt !== null;
  const [only] = versions;
  return (
    <View className="gap-4 px-4">
      {isArchived ? (
        <InlineNotice
          icon={ArchiveIcon}
          message="Está archivado: no aparece en tu lista ni al registrar ventas. Tus ventas pasadas no cambian."
        />
      ) : null}
      <PhotoGallery photos={product.photos} productName={product.name} />
      {product.description === null ? null : (
        <Text selectable className="text-base text-foreground">
          {product.description}
        </Text>
      )}
      {versions.length === 0 ? (
        <InlineNotice
          message={
            isArchived
              ? 'Este producto no tiene precios para vender. Edítalo para agregar uno y después podrás volver a usarlo.'
              : 'Este producto no tiene precios para vender. Edítalo para agregar uno.'
          }
        />
      ) : null}
      {versions.length === 1 && only !== undefined ? <SinglePrice version={only} /> : null}
      {versions.length > 1 ? <VersionsCard versions={versions} /> : null}
    </View>
  );
}
