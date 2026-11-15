import { useEffect, useRef } from 'react';
import { useController, useWatch, type Control, type UseFormSetFocus } from 'react-hook-form';
import { Text, View } from 'react-native';

import {
  ChipGroup,
  DeleteButton,
  FormAmountField,
  FormTextField,
  PlusIcon,
  TextButton,
} from '@/shared/ui';

import { VERSION_NAME_MAX_LENGTH } from '../domain';
import { describeProductError } from './error-messages';
import {
  versionPath,
  type ProductFormValues,
  type UpdateProductFormOutput,
} from './product-form-schema';

/** Form control of the product form. */
export type ProductFormControl = Control<ProductFormValues, unknown, UpdateProductFormOutput>;

/** Props of {@link VersionFields}. */
export interface VersionFieldsProps {
  readonly control: ProductFormControl;
  readonly setFocus: UseFormSetFocus<ProductFormValues>;
  readonly index: number;
  readonly isMultiple: boolean;
  readonly onRemove: (index: number) => void;
}

const PRICE_OPTIONS = [
  { value: 'fixed', label: 'Precio fijo' },
  { value: 'negotiable', label: 'A convenir' },
] as const;

/**
 * Fields of one version (design 3.5): name (only with two or more), fixed or negotiable
 * price, optional cost revealed with "Agregar costo" and, with two or more, "Quitar versión".
 * With a single version the word "versión" never appears.
 */
export function VersionFields({
  control,
  setFocus,
  index,
  isMultiple,
  onRemove,
}: VersionFieldsProps) {
  const prefix = versionPath(index);
  const mode = useController({ control, name: `${prefix}.pricingMode` });
  const costVisible = useController({ control, name: `${prefix}.costVisible` });
  const name = useWatch({ control, name: `${prefix}.name` });
  const wasCostVisible = useRef(costVisible.field.value);

  useEffect(() => {
    if (costVisible.field.value && !wasCostVisible.current) {
      setFocus(`${prefix}.costText`);
    }
    wasCostVisible.current = costVisible.field.value;
  }, [costVisible.field.value, prefix, setFocus]);

  const versionName = name.trim();
  const named = (build: (versionName: string) => string) =>
    versionName === '' ? undefined : build(versionName);

  return (
    <View className="gap-4">
      {isMultiple ? (
        <FormTextField
          control={control}
          name={`${prefix}.name`}
          label="Nombre de la versión"
          placeholder="Por ejemplo, Print A3"
          maxLength={VERSION_NAME_MAX_LENGTH}
          describeError={describeProductError}
        />
      ) : null}
      <ChipGroup
        label="Precio"
        accessibilityLabel={named((value) => `Precio de ${value}`)}
        options={PRICE_OPTIONS}
        value={mode.field.value}
        onChange={mode.field.onChange}
      />
      {mode.field.value === 'fixed' ? (
        <FormAmountField
          control={control}
          name={`${prefix}.priceText`}
          label="¿A cuánto lo vendes?"
          accessibilityLabel={named((value) => `¿A cuánto vendes ${value}?`)}
          placeholder="15.000"
          describeError={describeProductError}
        />
      ) : (
        <Text className="text-sm text-muted">El precio lo escribes al registrar cada venta.</Text>
      )}
      {costVisible.field.value ? (
        <FormAmountField
          control={control}
          name={`${prefix}.costText`}
          label="¿Cuánto te cuesta hacerlo?"
          accessibilityLabel={named((value) => `¿Cuánto te cuesta hacer ${value}?`)}
          isOptional
          placeholder="3.000"
          helper="Solo lo ves tú. Sirve para saber cuánto te queda de cada venta. Puedes dejarlo vacío."
          describeError={describeProductError}
        />
      ) : (
        <View className="items-start">
          <TextButton
            label="Agregar costo"
            icon={PlusIcon}
            accessibilityHint="Muestra un campo para anotar cuánto te cuesta"
            onPress={() => {
              costVisible.field.onChange(true);
            }}
          />
        </View>
      )}
      {isMultiple ? (
        <View className="items-start">
          <DeleteButton
            label="Quitar versión"
            accessibilityLabel={named((value) => `Quitar versión ${value}`)}
            onPress={() => {
              onRemove(index);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
