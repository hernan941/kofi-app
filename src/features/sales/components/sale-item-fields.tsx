import { useController, useFormState, useWatch, type Control } from 'react-hook-form';
import { Text, View } from 'react-native';

import { activeVersions, type Product, type ProductVersion } from '@/features/products/domain';
import { formatClpAccessible } from '@/shared/domain';
import {
  AccessibleGroup,
  Amount,
  ArchiveIcon,
  DeleteButton,
  FormAmountField,
  Icon,
  QuantityStepper,
  TextButton,
  WarningCircleIcon,
} from '@/shared/ui';

import { QUANTITY_MAX, QUANTITY_MIN, type SaveSaleRecordInput } from '../domain';
import { describeSaleError } from './error-messages';
import { ProductThumbnail, coverPhotoIdOf } from '@/features/products';
import { formTotal, itemPath, type SaleFormValues } from './sale-form-schema';

/** Control del formulario de venta. */
export type SaleFormControl = Control<SaleFormValues, unknown, SaveSaleRecordInput>;

/** Props of {@link SaleItemFields}. */
export interface SaleItemFieldsProps {
  readonly control: SaleFormControl;
  readonly index: number;
  /** Producto del catálogo conocido; `null` si ya no existe (datos rotos). */
  readonly product: Product | null;
  readonly showThumbnail: boolean;
  readonly onChangeVersion: (index: number) => void;
  readonly onRemove: (index: number) => void;
}

/** Si la versión existe y sigue a la venta. */
function isActiveVersion(version: ProductVersion | undefined): boolean {
  return version?.archivedAt === null;
}

/** Nombre de la versión de la fila y si ya no está a la venta. */
function versionInfo(product: Product | null, versionId: string) {
  const version = product?.versions.find((candidate) => candidate.id === versionId);
  return {
    name: version?.name ?? null,
    isArchived: product?.archivedAt !== null || !isActiveVersion(version),
  };
}

/**
 * Un producto elegido (3.3): miniatura, nombre, versión (solo si el producto tiene más de
 * una) con "Cambiar", cantidad que se puede escribir, precio de cada uno y "Quitar". Con
 * cantidad mayor que 1 muestra el subtotal. Un producto archivado (al editar) conserva
 * cantidad y precio editables, pero no ofrece cambiar de versión.
 */
export function SaleItemFields({
  control,
  index,
  product,
  showThumbnail,
  onChangeVersion,
  onRemove,
}: SaleItemFieldsProps) {
  const prefix = itemPath(index);
  const row = useWatch({ control, name: prefix });
  const quantity = useController({ control, name: `${prefix}.quantity` });
  const { errors } = useFormState({ control, name: prefix });
  const rowError = errors.items?.[index]?.productVersionId?.message;

  const name = product?.name ?? 'Producto sin nombre';
  const { name: versionName, isArchived } = versionInfo(product, row.productVersionId);
  const hasSeveralVersions = (product?.versions.length ?? 0) > 1;
  const canChangeVersion = product !== null && !isArchived && activeVersions(product).length > 1;
  const detail = [hasSeveralVersions ? versionName : null, isArchived ? 'Archivado' : null]
    .filter((part) => part !== null)
    .join(' · ');
  const subtotal = formTotal([row]);

  return (
    <View className="gap-3 py-3">
      <View className="flex-row items-center gap-3">
        {showThumbnail ? <ProductThumbnail coverPhotoId={coverPhotoIdOf(product)} /> : null}
        <View className="min-w-32 flex-1 gap-0.5">
          <Text className="font-medium text-base text-foreground">{name}</Text>
          {detail === '' ? null : (
            <View className="flex-row items-center gap-1">
              {isArchived ? <Icon icon={ArchiveIcon} size="sm" color="muted" /> : null}
              <Text className="font-medium text-xs text-muted">{detail}</Text>
            </View>
          )}
        </View>
        {canChangeVersion ? (
          <TextButton
            label="Cambiar"
            accessibilityLabel={`Cambiar versión de ${name}`}
            onPress={() => {
              onChangeVersion(index);
            }}
          />
        ) : null}
      </View>
      <View className="flex-row flex-wrap items-start gap-4">
        <QuantityStepper
          label="Cantidad"
          accessibilityLabel={`Cantidad de ${name}`}
          decrementLabel={`Quitar uno a la cantidad de ${name}`}
          incrementLabel={`Agregar uno a la cantidad de ${name}`}
          value={quantity.field.value}
          onChange={quantity.field.onChange}
          min={QUANTITY_MIN}
          max={QUANTITY_MAX}
        />
        <View className="min-w-40 flex-1">
          <FormAmountField
            control={control}
            name={`${prefix}.priceText`}
            label="Precio de cada uno"
            accessibilityLabel={`Precio de cada uno de ${name}`}
            placeholder="15.000"
            helper={row.pricingMode === 'negotiable' ? 'Escribe a cuánto lo vendiste.' : undefined}
            describeError={describeSaleError}
          />
        </View>
      </View>
      {rowError === undefined ? null : (
        <View className="flex-row items-start gap-1">
          <Icon icon={WarningCircleIcon} size="sm" color="danger" />
          <Text className="flex-1 text-sm text-danger">
            {describeSaleError({ type: 'custom', message: rowError })}
          </Text>
        </View>
      )}
      <View className="flex-row items-center justify-between gap-2">
        <DeleteButton
          label="Quitar"
          accessibilityLabel={`Quitar ${name}`}
          onPress={() => {
            onRemove(index);
          }}
        />
        {row.quantity > 1 ? (
          <AccessibleGroup
            label={`Subtotal: ${formatClpAccessible(subtotal)}`}
            contentClassName="flex-row items-baseline gap-2"
          >
            <Text className="text-sm text-muted">Subtotal</Text>
            <Amount value={subtotal} variant="inline" />
          </AccessibleGroup>
        ) : null}
      </View>
    </View>
  );
}
