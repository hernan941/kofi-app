import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, useFormState, useWatch } from 'react-hook-form';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  productVersionIdSchema,
  type ProductId,
  type ProductVersionId,
  type Result,
} from '@/shared/domain';
import { useConfirmLeave } from '@/shared/lib/use-confirm-leave';
import {
  Card,
  FORM_ERRORS_ANNOUNCEMENT,
  ConfirmDialog,
  FormTextField,
  InlineNotice,
  ListSeparator,
  PlusIcon,
  PrimaryButton,
  TextButton,
  announce,
  type ButtonHandle,
  createSubmitHandler,
  StyledSafeAreaView,
} from '@/shared/ui';

import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  type ProductError,
  type ProductErrors,
} from '../domain';
import { usePhotoImports } from '../hooks/use-photo-imports';
import { useRemovePhotoFiles } from '../hooks/use-remove-photo-files';
import { describeProductError } from './error-messages';
import { PHOTO_MESSAGES } from '../messages/photo-messages';
import { PhotoStrip } from './photo-strip';
import {
  applyProductErrors,
  productFormSchema,
  versionPath,
  withAddedVersion,
  type ProductFormValues,
  type UpdateProductFormOutput,
} from './product-form-schema';
import { VersionFields } from './version-fields';

/** Props of {@link ProductForm}. */
export interface ProductFormProps {
  readonly initialValues: ProductFormValues;
  readonly productId?: ProductId;
  /** Versions with sales, as a hint for the "Quitar versión" dialog; `undefined` while unknown. */
  readonly versionIdsWithSales?: ReadonlySet<ProductVersionId>;
  /** Note above the form (for example "this product is archived"). */
  readonly notice?: string;
  /** Saves the output; resolves to `null` when the screen already reported an unexpected failure. */
  readonly onSubmit: (
    output: UpdateProductFormOutput,
  ) => Promise<Result<ProductId, ProductErrors> | null>;
  readonly onSaved: (id: ProductId) => void;
  /** Errors that belong to no field (for example `product_not_found`), with a way to leave without the "Salir sin guardar" question. */
  readonly onUnmappedErrors: (
    errors: readonly ProductError[],
    leaveWithoutAsking: (action: () => void) => void,
  ) => void;
}

/** Version waiting for the confirmation to be removed. */
interface PendingRemoval {
  readonly index: number;
  readonly versionId: ProductVersionId;
  readonly name: string;
}

/** Texts of the "Quitar versión" dialog according to what is known about the sales. */
function removalDescription(hasSales: boolean | undefined): string {
  if (hasSales === undefined) {
    return 'Si ya la vendiste, queda guardada en tu historial y tus ventas pasadas no cambian. Si no, se borra. Se aplica cuando guardes.';
  }
  return hasSales
    ? 'Como ya la vendiste, queda guardada en tu historial y tus ventas pasadas no cambian. No aparecerá al registrar ventas nuevas. Se aplica cuando guardes.'
    : 'Se borra cuando guardes los cambios.';
}

/**
 * Form to create or edit a product (design 3.5 to 3.8) with React Hook Form: versions in a
 * `useFieldArray`, errors from `useFormState` and the schema as resolver. It owns the layout
 * (scroll, fixed "Guardar" and keyboard), the "Quitar versión" dialog and "Salir sin guardar".
 * The screen only saves and navigates.
 */
export function ProductForm({
  initialValues,
  productId,
  versionIdsWithSales,
  notice,
  onSubmit,
  onSaved,
  onUnmappedErrors,
}: ProductFormProps) {
  const form = useForm<ProductFormValues, unknown, UpdateProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'versions' });
  const { isDirty } = useFormState({ control: form.control });
  const leave = useConfirmLeave(isDirty);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const isSaving = useRef(false);
  const isSaved = useRef(false);
  const [isWaitingForPhotos, setIsWaitingForPhotos] = useState(false);
  const photos = useWatch({ control: form.control, name: 'photos' });
  const productName = useWatch({ control: form.control, name: 'name' });
  const removePhotoFiles = useRemovePhotoFiles();
  const imports = usePhotoImports({
    photoCount: photos.length,
    onImported: (added) => {
      const next = [
        ...form.getValues('photos'),
        ...added.map(({ id, ...rest }) => ({ ...rest, photoId: id, isNew: true })),
      ];
      form.setValue('photos', next, { shouldDirty: true });
      return next.length;
    },
  });

  const { waitForIdle } = imports;

  useEffect(
    () => () => {
      void (async () => {
        await waitForIdle();
        if (isSaved.current || isSaving.current) return;
        const unsaved = form
          .getValues('photos')
          .filter((photo) => photo.isNew)
          .map((photo) => photo.photoId);
        await removePhotoFiles(unsaved);
      })();
    },
    [form, removePhotoFiles, waitForIdle],
  );
  const addButton = useRef<ButtonHandle>(null);
  const isMultiple = fields.length > 1;

  const focusAddButton = () => {
    requestAnimationFrame(() => {
      if (addButton.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(addButton.current, 'focus');
      }
    });
  };

  const save = async (output: UpdateProductFormOutput) => {
    if (isSaving.current) return;
    isSaving.current = true;
    try {
      const result = await onSubmit(output);
      if (result === null) return;
      if (result.ok) {
        isSaved.current = true;
        leave.leaveWithoutAsking(() => {
          onSaved(result.value);
        });
        return;
      }
      const unmapped = applyProductErrors(result.error, form.setError);
      if (unmapped.length < result.error.length) announce(FORM_ERRORS_ANNOUNCEMENT);
      if (unmapped.length > 0) onUnmappedErrors(unmapped, leave.leaveWithoutAsking);
    } finally {
      isSaving.current = false;
    }
  };

  const submit = async () => {
    if (imports.pendingCount > 0) {
      announce(PHOTO_MESSAGES.waitingForPhotos);
      setIsWaitingForPhotos(true);
      await imports.waitForIdle();
      setIsWaitingForPhotos(false);
    }
    createSubmitHandler(form.handleSubmit, save)();
  };

  const addVersion = () => {
    const next = withAddedVersion(form.getValues());
    const [first] = next.versions;
    if (first !== undefined && first.name !== form.getValues('versions.0.name')) {
      form.setValue('versions.0.name', first.name, { shouldDirty: true });
    }
    const added = next.versions.at(-1);
    if (added !== undefined) {
      append(added, { focusName: `${versionPath(fields.length)}.name` });
      announce('Agregaste una versión. Ponle un nombre.');
    }
  };

  const removeVersion = (index: number) => {
    const row = form.getValues(versionPath(index));
    if (row.versionId === null) {
      remove(index);
      announce('Quitaste la versión.');
      focusAddButton();
      return;
    }
    setPendingRemoval({
      index,
      versionId: productVersionIdSchema.parse(row.versionId),
      name: row.name.trim(),
    });
  };

  const confirmRemoval = () => {
    if (pendingRemoval === null) return;
    form.setValue(
      'removedVersionIds',
      [...form.getValues('removedVersionIds'), pendingRemoval.versionId],
      { shouldDirty: true },
    );
    remove(pendingRemoval.index);
    setPendingRemoval(null);
    announce('Quitaste la versión.');
    focusAddButton();
  };

  const hasSales =
    pendingRemoval === null || versionIdsWithSales === undefined
      ? undefined
      : versionIdsWithSales.has(pendingRemoval.versionId);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-4 pb-6">
        {notice === undefined ? null : <InlineNotice message={notice} />}
        <FormTextField
          control={form.control}
          name="name"
          label="Nombre"
          placeholder="Por ejemplo, Lámina Colibrí"
          maxLength={PRODUCT_NAME_MAX_LENGTH}
          autoCapitalize="sentences"
          returnKeyType="next"
          describeError={describeProductError}
        />
        <FormTextField
          control={form.control}
          name="description"
          label="Descripción"
          isOptional
          placeholder="Técnica, tamaño, materiales…"
          multiline
          maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
          describeError={describeProductError}
        />
        <PhotoStrip
          photos={photos}
          productName={productName}
          imports={imports}
          onChange={(next) => {
            form.setValue('photos', [...next], { shouldDirty: true });
          }}
          onRemove={(removed) => {
            form.setValue(
              'photos',
              form.getValues('photos').filter((photo) => photo.photoId !== removed.photoId),
              { shouldDirty: true },
            );
            if (removed.isNew) {
              void removePhotoFiles([removed.photoId]);
            }
          }}
        />
        <Card title={isMultiple ? 'Versiones' : undefined}>
          {isMultiple ? (
            <Text className="text-sm text-muted">Cada versión tiene su propio precio.</Text>
          ) : null}
          <View className="gap-6">
            {fields.map((field, index) => (
              <Fragment key={field.id}>
                {index > 0 ? <ListSeparator /> : null}
                <VersionFields
                  control={form.control}
                  setFocus={form.setFocus}
                  index={index}
                  isMultiple={isMultiple}
                  onRemove={removeVersion}
                />
              </Fragment>
            ))}
          </View>
          <View className="items-start">
            <TextButton
              ref={addButton}
              label={isMultiple ? 'Agregar otra versión' : 'Agregar otra opción'}
              icon={PlusIcon}
              accessibilityHint={isMultiple ? undefined : 'Por ejemplo, otro tamaño o el original'}
              onPress={addVersion}
            />
          </View>
          {isMultiple ? null : (
            <Text className="text-sm text-muted">
              Por ejemplo, Print A4 y Print A3, o enmarcado. Cada una con su precio.
            </Text>
          )}
        </Card>
      </ScrollView>
      <StyledSafeAreaView edges={['bottom']} className="px-4 pt-2 pb-4">
        <PrimaryButton
          label={isWaitingForPhotos ? PHOTO_MESSAGES.savingLabel : 'Guardar'}
          accessibilityState={isWaitingForPhotos ? { busy: true } : undefined}
          onPress={() => {
            void submit();
          }}
        />
      </StyledSafeAreaView>
      <ConfirmDialog
        isOpen={pendingRemoval !== null}
        title={pendingRemoval?.name ? `¿Quitar ${pendingRemoval.name}?` : '¿Quitar esta versión?'}
        description={removalDescription(hasSales)}
        confirmLabel="Quitar"
        isDestructive={hasSales !== true}
        onConfirm={confirmRemoval}
        onCancel={() => {
          setPendingRemoval(null);
        }}
      />
      <ConfirmDialog
        isOpen={leave.isOpen}
        title="¿Salir sin guardar?"
        description="Los cambios que hiciste no se guardarán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        isDestructive
        onConfirm={leave.confirm}
        onCancel={leave.cancel}
      />
    </KeyboardAvoidingView>
  );
}
