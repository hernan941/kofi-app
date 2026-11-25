import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useController, useFieldArray, useForm, useFormState, useWatch } from 'react-hook-form';
import { AccessibilityInfo, Text, View } from 'react-native';

import { activeVersions, type Product, type ProductVersion } from '@/features/products/domain';
import {
  formatClpAccessible,
  isoWeekStart,
  type LocalDate,
  type ProductId,
  type Result,
} from '@/shared/domain';
import { useConfirmLeave } from '@/shared/lib/use-confirm-leave';
import { useScheduleFrame } from '@/shared/lib/use-schedule-frame';
import { useToday } from '@/shared/lib/time/use-today';
import {
  AccessibleGroup,
  Amount,
  Card,
  CaretDownIcon,
  CaretUpIcon,
  CalendarBlankIcon,
  ChipGroup,
  ConfirmDialog,
  DateField,
  DatePickerSheet,
  FORM_ERRORS_ANNOUNCEMENT,
  FormTextField,
  Icon,
  InlineNotice,
  ListSeparator,
  PlusIcon,
  PrimaryButton,
  CheckIcon,
  TextButton,
  WarningCircleIcon,
  announce,
  createSubmitHandler,
  useAnnounceWhen,
  type ButtonHandle,
  FormLayout,
} from '@/shared/ui';

import {
  SALE_CHANNELS,
  SALE_ITEMS_MAX,
  SALE_NOTE_MAX_LENGTH,
  type SaleError,
  type SaleErrors,
  type SaveSaleRecordInput,
} from '../domain';
import { useMarkedWeeks } from '../hooks/use-marked-weeks';
import { perfMark } from '@/shared/lib/perf-marks';
import type { SaveSaleRecordResult } from '../use-cases/save-sale-record';
import { SALE_CHANNEL_LABELS } from './channel-labels';
import { describeSaleError } from './error-messages';
import { NoSalesSection } from './no-sales-section';
import { ProductPicker, ProductPickerSheet } from './product-picker';
import { anyProductHasCover } from '@/features/products';
import { SaleItemFields } from './sale-item-fields';
import {
  applySaleErrors,
  formTotal,
  itemPath,
  newItemValues,
  saleFormSchema,
  type SaleFormValues,
  type SaleItemFormValues,
} from './sale-form-schema';

/** Props of {@link SaleForm}. */
export interface SaleFormProps {
  readonly mode: 'create' | 'edit';
  readonly initialValues: SaleFormValues;
  /** Productos que se pueden agregar (activos con alguna versión activa). */
  readonly sellable: readonly Product[];
  /** Todos los productos que el formulario conoce, también los archivados de los ítems guardados. */
  readonly catalog: ReadonlyMap<ProductId, Product>;
  /** Guarda; resuelve `null` si la pantalla ya avisó de un fallo inesperado. */
  readonly onSubmit: (
    output: SaveSaleRecordInput,
  ) => Promise<Result<SaveSaleRecordResult, SaleErrors> | null>;
  readonly onSaved: (result: SaveSaleRecordResult, output: SaveSaleRecordInput) => void;
  /** Errores sin campo, con la forma de salir sin la pregunta "Salir sin guardar". */
  readonly onUnmappedErrors: (
    errors: readonly SaleError[],
    leaveWithoutAsking: (action: () => void) => void,
  ) => void;
}

/** Destino de la hoja de productos: agregar uno nuevo o cambiar la versión de una fila. */
type PickerTarget =
  | { readonly kind: 'add'; readonly product?: Product }
  | { readonly kind: 'change'; readonly product: Product; readonly index: number };

const MAX_ROWS_NOTICE =
  'Llegaste a 100 productos en esta venta. Guárdala y registra el resto en otra.';

/** `true` si las filas siguen como empezaron (sin agregar, quitar ni cambiar productos). */
function sameRows(a: readonly SaleItemFormValues[], b: readonly SaleItemFormValues[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (row, index) =>
        row.productVersionId === b[index]?.productVersionId &&
        row.quantity === b[index].quantity &&
        row.priceText === b[index].priceText,
    )
  );
}

/** Texto del botón "Más detalles" con lo que hay adentro: "Más detalles (Feria, con nota)". */
function detailsLabel(channel: SaleFormValues['channel'], note: string): string {
  const parts = [
    channel === null ? null : SALE_CHANNEL_LABELS[channel],
    note.trim() === '' ? null : 'con nota',
  ].filter((part) => part !== null);
  return parts.length === 0 ? 'Más detalles' : `Más detalles (${parts.join(', ')})`;
}

/** Nombre con el que se anuncia un producto agregado. */
function addedAnnouncement(product: Product, version: ProductVersion, isRepeat: boolean): string {
  if (isRepeat) return `Agregaste ${product.name} de nuevo.`;
  const hasSeveral = activeVersions(product).length > 1 && version.name !== null;
  return hasSeveral ? `Agregaste ${product.name}, ${version.name}.` : `Agregaste ${product.name}.`;
}

/**
 * Formulario de venta (3.1 y 3.9) con React Hook Form: fecha, productos en un `useFieldArray`,
 * "más detalles" (canal y nota), el panel de "no vendí" al registrar y el pie fijo con el
 * total y el botón. Se ocupa del diseño (scroll, pie y teclado), de la hoja de productos,
 * de quitar el último producto al editar y de "Salir sin guardar". La pantalla solo guarda
 * y navega.
 */
export function SaleForm({
  mode,
  initialValues,
  sellable,
  catalog,
  onSubmit,
  onSaved,
  onUnmappedErrors,
}: SaleFormProps) {
  const today = useToday();
  const markedWeeks = useMarkedWeeks();
  const form = useForm<SaleFormValues, unknown, SaveSaleRecordInput>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: initialValues,
  });
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  const { isDirty, errors } = useFormState({ control: form.control });
  const leave = useConfirmLeave(isDirty);
  const soldOn = useController({ control: form.control, name: 'soldOn' });
  const channel = useController({ control: form.control, name: 'channel' });
  const note = useWatch({ control: form.control, name: 'note' });
  const items = useWatch({ control: form.control, name: 'items' });
  const [isDetailsOpen, setIsDetailsOpen] = useState(
    initialValues.channel !== null || initialValues.note !== '',
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [isConfirmingLast, setIsConfirmingLast] = useState(false);
  const isSaving = useRef(false);
  const isFirstRender = useRef(true);
  const addButton = useRef<ButtonHandle>(null);
  const scheduleFrame = useScheduleFrame();

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!form.formState.isDirty) form.reset(initialValues);
  }, [form, initialValues]);

  const knownProducts = useMemo(
    () => new Map([...sellable.map((p) => [p.id, p] as const), ...catalog]),
    [sellable, catalog],
  );
  const showThumbnails = useMemo(
    () => anyProductHasCover([...knownProducts.values()]),
    [knownProducts],
  );
  const total = formTotal(items);
  const rootError = errors.items?.root?.message;
  useAnnounceWhen(
    rootError === undefined ? undefined : describeSaleError({ type: 'custom', message: rootError }),
  );
  const isUntouched = sameRows(items, initialValues.items);
  const isWeekMarked = markedWeeks?.has(isoWeekStart(soldOn.field.value)) === true;

  const focusAddButton = (message?: string) => {
    scheduleFrame(() => {
      if (addButton.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(addButton.current, 'focus');
      }
      if (message !== undefined) announce(message);
    });
  };

  const addItem = (product: Product, version: ProductVersion) => {
    const row = newItemValues(product, version);
    const isRepeat = form.getValues('items').some((r) => r.productVersionId === version.id);
    append(
      row,
      row.pricingMode === 'negotiable'
        ? { focusName: `${itemPath(fields.length)}.priceText` }
        : undefined,
    );
    setPicker(null);
    focusAddButton(addedAnnouncement(product, version, isRepeat));
  };

  const changeVersion = (index: number, product: Product, version: ProductVersion) => {
    const current = form.getValues(itemPath(index));
    update(index, {
      ...newItemValues(product, version),
      itemId: current.itemId,
      quantity: current.quantity,
    });
    setPicker(null);
    focusAddButton(`Ahora es ${version.name ?? product.name}.`);
  };

  const pick = (product: Product, version: ProductVersion) => {
    if (picker?.kind === 'change') changeVersion(picker.index, product, version);
    else addItem(product, version);
  };

  const removeRow = (index: number) => {
    if (mode === 'edit' && fields.length === 1) {
      setIsConfirmingLast(true);
      return;
    }
    const product = knownProducts.get(form.getValues(itemPath(index)).productId);
    remove(index);
    announce(`Quitaste ${product?.name ?? 'el producto'}.`);
    focusAddButton();
  };

  const save = async (output: SaveSaleRecordInput) => {
    if (isSaving.current) return;
    isSaving.current = true;
    try {
      const result = await onSubmit(output);
      if (result === null) return;
      if (result.ok) {
        leave.leaveWithoutAsking(() => {
          onSaved(result.value, output);
        });
        return;
      }
      const unmapped = applySaleErrors(result.error, form.setError);
      if (unmapped.length < result.error.length) announce(FORM_ERRORS_ANNOUNCEMENT);
      if (unmapped.length > 0) onUnmappedErrors(unmapped, leave.leaveWithoutAsking);
    } finally {
      isSaving.current = false;
    }
  };

  const submit = () => {
    if (process.env.EXPO_PUBLIC_E2E === '1') {
      perfMark('sale:save:press');
    }
    createSubmitHandler(form.handleSubmit, save)();
  };

  const confirmRemoveLast = () => {
    setIsConfirmingLast(false);
    remove(0);
    submit();
  };

  const openProductSheet = (product?: Product) => {
    setPicker({ kind: 'add', product });
  };

  const hasRows = fields.length > 0;
  const dateError = errors.soldOn?.message;

  return (
    <FormLayout
      contentContainerClassName="gap-6 px-4 pb-6"
      footer={
        <View className="gap-2">
          {hasRows ? (
            <AccessibleGroup
              label={`Total: ${formatClpAccessible(total)}`}
              contentClassName="flex-row flex-wrap items-baseline justify-between gap-2"
            >
              <Text className="font-medium text-base text-foreground">Total</Text>
              <Amount value={total} variant="total" />
            </AccessibleGroup>
          ) : null}
          <PrimaryButton
            label={mode === 'create' ? 'Guardar venta' : 'Guardar cambios'}
            icon={CheckIcon}
            onPress={submit}
          />
        </View>
      }
      overlays={
        <>
          <ProductPickerSheet
            isOpen={picker !== null}
            products={sellable}
            initialProduct={picker?.product}
            showThumbnails={showThumbnails}
            onPick={pick}
            onClose={() => {
              setPicker(null);
            }}
          />
          <DatePickerSheet
            isOpen={isCalendarOpen}
            title="¿Qué día vendiste?"
            value={soldOn.field.value}
            maxDate={today}
            today={today}
            onSelect={(next) => {
              soldOn.field.onChange(next);
            }}
            onClose={() => {
              setIsCalendarOpen(false);
            }}
          />
          <ConfirmDialog
            isOpen={isConfirmingLast}
            title="¿Borrar esta venta?"
            description="Si quitas el último producto, la venta se borra. No se puede deshacer."
            confirmLabel="Borrar venta"
            isDestructive
            onConfirm={confirmRemoveLast}
            onCancel={() => {
              setIsConfirmingLast(false);
            }}
          />
          <ConfirmDialog
            isOpen={leave.isOpen}
            title="¿Salir sin guardar?"
            description={
              mode === 'create'
                ? 'La venta que estabas anotando no se guardará.'
                : 'Los cambios que hiciste no se guardarán.'
            }
            confirmLabel="Salir sin guardar"
            cancelLabel={mode === 'create' ? 'Seguir anotando' : 'Seguir editando'}
            isDestructive
            onConfirm={leave.confirm}
            onCancel={leave.cancel}
          />
        </>
      }
    >
      <View className="gap-2">
        <DateField
          label="¿Cuándo vendiste?"
          value={soldOn.field.value}
          onChange={(next: LocalDate) => {
            soldOn.field.onChange(next);
          }}
          maxDate={today}
          today={today}
        />
        <View className="items-end">
          <TextButton
            label="Elegir otra fecha"
            icon={CalendarBlankIcon}
            onPress={() => {
              setIsCalendarOpen(true);
            }}
          />
        </View>
        {dateError === undefined ? null : (
          <View className="flex-row items-start gap-1">
            <Icon icon={WarningCircleIcon} size="sm" color="danger" />
            <Text className="flex-1 text-sm text-danger">
              {describeSaleError({ type: 'custom', message: dateError })}
            </Text>
          </View>
        )}
        {mode === 'create' && isWeekMarked ? (
          <InlineNotice message='Marcaste esa semana como "no vendí". Si guardas esta venta, esa marca se quita.' />
        ) : null}
      </View>

      <View className="gap-3">
        <Text accessibilityRole="header" className="font-semibold text-heading text-foreground">
          ¿Qué vendiste?
        </Text>
        {hasRows ? (
          <>
            <Card>
              {fields.map((field, index) => (
                <View key={field.id}>
                  {index > 0 ? <ListSeparator /> : null}
                  <SaleItemFields
                    control={form.control}
                    index={index}
                    product={
                      items[index] === undefined
                        ? null
                        : (knownProducts.get(items[index].productId) ?? null)
                    }
                    showThumbnail={showThumbnails}
                    onChangeVersion={(rowIndex) => {
                      const product = knownProducts.get(
                        form.getValues(itemPath(rowIndex)).productId,
                      );
                      if (product) setPicker({ kind: 'change', product, index: rowIndex });
                    }}
                    onRemove={removeRow}
                  />
                </View>
              ))}
            </Card>
            {fields.length >= SALE_ITEMS_MAX ? (
              <InlineNotice message={MAX_ROWS_NOTICE} />
            ) : (
              <View className="items-start">
                <TextButton
                  ref={addButton}
                  label="Agregar otro producto"
                  icon={PlusIcon}
                  onPress={() => {
                    openProductSheet();
                  }}
                />
              </View>
            )}
          </>
        ) : (
          <Card>
            <ProductPicker
              products={sellable}
              showThumbnails={showThumbnails}
              onSelect={(product) => {
                const [only, ...others] = activeVersions(product);
                if (only !== undefined && others.length === 0) addItem(product, only);
                else openProductSheet(product);
              }}
            />
          </Card>
        )}
        {rootError === undefined ? null : (
          <View className="flex-row items-start gap-1">
            <Icon icon={WarningCircleIcon} size="sm" color="danger" />
            <Text className="flex-1 text-sm text-danger">
              {describeSaleError({ type: 'custom', message: rootError })}
            </Text>
          </View>
        )}
      </View>

      <View className="gap-3">
        <View className="items-start">
          <TextButton
            label={detailsLabel(channel.field.value, note)}
            icon={isDetailsOpen ? CaretUpIcon : CaretDownIcon}
            accessibilityHint="Dónde vendiste y una nota"
            accessibilityState={{ expanded: isDetailsOpen }}
            onPress={() => {
              setIsDetailsOpen((open) => !open);
            }}
          />
        </View>
        {isDetailsOpen ? (
          <View className="gap-4">
            <ChipGroup
              label="¿Dónde vendiste? (opcional)"
              allowDeselect
              options={SALE_CHANNELS.map((value) => ({
                value,
                label: SALE_CHANNEL_LABELS[value],
              }))}
              value={channel.field.value}
              onChange={channel.field.onChange}
            />
            <FormTextField
              control={form.control}
              name="note"
              label="Nota"
              isOptional
              placeholder="Por ejemplo, feria del parque o pedido de Ana"
              multiline
              maxLength={SALE_NOTE_MAX_LENGTH}
              describeError={describeSaleError}
            />
          </View>
        ) : null}
      </View>

      {mode === 'create' && isUntouched ? <NoSalesSection /> : null}
    </FormLayout>
  );
}
