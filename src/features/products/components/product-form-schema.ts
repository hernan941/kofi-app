import type { UseFormSetError } from 'react-hook-form';
import { z } from 'zod';

import {
  formatClpDigits,
  productPhotoIdSchema,
  productVersionIdSchema,
  type Clp,
  type ProductId,
  type ProductPhotoId,
} from '@/shared/domain';
import { clpTextSchema, optionalClpTextSchema } from '@/shared/ui';

import {
  activeVersions,
  firstVersionNameOnSplit,
  orderedPhotos,
  productDescriptionSchema,
  productNameSchema,
  versionNameIssues,
  versionNameSchema,
  type PhotoChangesInput,
  type Product,
  type ProductError,
  type ProductErrorCode,
  type ProductErrors,
  type UpdateProductInput,
} from '../domain';
import type { SaveProductCommand } from '../use-cases/save-product';

/** Values of the row of a version: everything as text, as the UI handles it. */
export interface VersionFormValues {
  /** Id of the existing version, or `null` if it is new. It is not called `id` to avoid the `useFieldArray` key. */
  readonly versionId: string | null;
  readonly name: string;
  readonly pricingMode: 'fixed' | 'negotiable';
  /** Kept when switching to "a convenir", so it is not lost if the person goes back to a fixed price. */
  readonly priceText: string;
  readonly costText: string;
  /** "Agregar costo" was touched or the version already had a cost. Presentation state; the schema drops it. */
  readonly costVisible: boolean;
}

/** Photo in the form: an existing one or one imported in this session; all that `StoredPhoto` needs. */
export interface PhotoFormValue {
  /** Id of the photo. It is not called `id` to avoid the `useFieldArray` key. */
  readonly photoId: ProductPhotoId;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
  /** `true` if it was imported in this session of the form and has no row yet. */
  readonly isNew: boolean;
}

/** Values of the product form. The arrays are mutable because the resolver and `useFieldArray` types require it. */
export interface ProductFormValues {
  readonly name: string;
  readonly description: string;
  versions: VersionFormValues[];
  /** Ids of existing versions the person removed; applied on save. */
  removedVersionIds: string[];
  /** Screen order; the first one is the cover (D-17). */
  photos: PhotoFormValue[];
}

/** Output of the form schema: the input of `updateProduct` (when creating, no id and nothing removed). */
export type UpdateProductFormOutput = UpdateProductInput & {
  readonly photos: PhotoChangesInput;
};

const PRICE_MODES = ['fixed', 'negotiable'] as const;

/** Copies the issues of a sub-schema into the transform context, under `path`. */
function forwardIssues(
  issues: readonly z.core.$ZodIssue[],
  path: string,
  context: z.RefinementCtx,
): void {
  for (const issue of issues) {
    context.addIssue({
      code: 'custom',
      message: issue.message,
      path: path === '' ? [] : [path],
    });
  }
}

const photoIdFieldSchema = z.custom<ProductPhotoId>(
  (value) => productPhotoIdSchema.safeParse(value).success,
);

const photoRowSchema = z
  .object({
    photoId: photoIdFieldSchema,
    width: z.number(),
    height: z.number(),
    byteSize: z.number(),
    sha256: z.string(),
    isNew: z.boolean(),
  })
  .transform(({ photoId, width, height, byteSize, sha256 }) => ({
    id: photoId,
    width,
    height,
    byteSize,
    sha256,
  }));

const versionRowSchema = z
  .object({
    versionId: z.string().nullable(),
    name: z.string(),
    pricingMode: z.enum(PRICE_MODES),
    priceText: z.string(),
    costText: z.string(),
    costVisible: z.boolean(),
  })
  .transform((row, context) => {
    const name = versionNameSchema.safeParse(row.name);
    const price = row.pricingMode === 'fixed' ? clpTextSchema.safeParse(row.priceText) : null;
    const cost = optionalClpTextSchema.safeParse(row.costText);
    if (!name.success) forwardIssues(name.error.issues, 'name', context);
    if (price && !price.success) forwardIssues(price.error.issues, 'priceText', context);
    if (!cost.success) forwardIssues(cost.error.issues, 'costText', context);
    if (!name.success || (price && !price.success) || !cost.success) {
      return z.NEVER;
    }
    return {
      versionId: row.versionId,
      name: name.data,
      pricing:
        price?.success === true
          ? ({ mode: 'fixed', price: price.data } as const)
          : ({ mode: 'negotiable' } as const),
      cost: cost.data,
    };
  });

/**
 * Form schema. Turns the text into the input of `updateProduct`: the price goes through
 * `clpTextSchema` only when it is fixed, the cost through `optionalClpTextSchema` (empty
 * becomes `null`) and `versionNameIssues` adds the rules that cross versions under
 * `versions.i.name`. The issue messages are error codes that `describeProductError` translates.
 */
export const productFormSchema = z
  .object({
    name: productNameSchema,
    description: z.string().transform((text, context) => {
      const parsed = productDescriptionSchema.safeParse(text);
      if (!parsed.success) {
        forwardIssues(parsed.error.issues, '', context);
        return z.NEVER;
      }
      return parsed.data;
    }),
    versions: z.array(versionRowSchema).min(1),
    removedVersionIds: z.array(productVersionIdSchema),
    photos: z.array(photoRowSchema),
  })
  .transform((form, context): UpdateProductFormOutput => {
    const issues = versionNameIssues(
      form.versions.map((version, index) => ({
        name: version.name,
        path: ['versions', index, 'name'],
      })),
    );
    for (const issue of issues) {
      context.addIssue({ code: 'custom', message: issue.code, path: [...issue.path] });
    }
    return {
      name: form.name,
      description: form.description,
      versions: form.versions.map(({ versionId, ...version }) =>
        versionId === null ? version : { ...version, id: productVersionIdSchema.parse(versionId) },
      ),
      removedVersionIds: form.removedVersionIds,
      photos: form.photos,
    };
  });

/** Path of the row `index` of the versions field array. */
export function versionPath(index: number): `versions.${number}` {
  return `versions.${String(index) as `${number}`}`;
}

/** Empty row of a new version: fixed price, no visible cost. */
export function emptyVersionRow(): VersionFormValues {
  return {
    versionId: null,
    name: '',
    pricingMode: 'fixed',
    priceText: '',
    costText: '',
    costVisible: false,
  };
}

/** Amount as the field shows it (`15.000`), without the `$`. */
function amountText(amount: Clp | null): string {
  return amount === null ? '' : formatClpDigits(amount);
}

/** Initial values: empty for creating, or from an existing product (active versions only). */
export function toProductFormValues(product: Product | null): ProductFormValues {
  if (product === null) {
    return {
      name: '',
      description: '',
      versions: [emptyVersionRow()],
      removedVersionIds: [],
      photos: [],
    };
  }
  return {
    name: product.name,
    description: product.description ?? '',
    versions: activeVersions(product).map((version) => ({
      versionId: version.id,
      name: version.name ?? '',
      pricingMode: version.pricing.mode,
      priceText: version.pricing.mode === 'fixed' ? amountText(version.pricing.price) : '',
      costText: amountText(version.cost),
      costVisible: version.cost !== null,
    })),
    removedVersionIds: [],
    photos: orderedPhotos(product.photos).map((photo) => ({
      photoId: photo.id,
      width: photo.width,
      height: photo.height,
      byteSize: photo.byteSize,
      sha256: photo.sha256,
      isNew: false,
    })),
  };
}

/** Converts the form output into the command of the use case. */
export function toSaveProductCommand(
  productId: ProductId | null,
  output: UpdateProductFormOutput,
): SaveProductCommand {
  if (productId !== null) {
    const { photos, ...input } = output;
    return { kind: 'update', productId, input, photos };
  }
  return {
    kind: 'create',
    input: {
      name: output.name,
      description: output.description,
      versions: output.versions.map(({ name, pricing, cost }) => ({ name, pricing, cost })),
    },
    photos: output.photos,
  };
}

/**
 * Values after "agregar otra versión": appends an empty row and, if there was a single
 * unnamed row, names it with `firstVersionNameOnSplit` (D-16), visible and editable.
 */
export function withAddedVersion(values: ProductFormValues): ProductFormValues {
  const [only, ...others] = values.versions;
  const renamed: VersionFormValues[] =
    only !== undefined && others.length === 0 && only.name.trim() === ''
      ? [{ ...only, name: firstVersionNameOnSplit([]) }]
      : values.versions;
  return { ...values, versions: [...renamed, emptyVersionRow()] };
}

const FIELD_PATH = /^(name|description|versions\.\d+\.name)$/;

/**
 * Puts the domain errors that have a field into the form (`setError(path, { message: code })`),
 * moving the focus to the first one, and returns the others, which the screen shows as a notice.
 */
export function applyProductErrors(
  errors: ProductErrors,
  setError: UseFormSetError<ProductFormValues>,
): readonly ProductError[] {
  const withoutField: ProductError[] = [];
  let isFirstFieldError = true;
  for (const error of errors) {
    const path = error.path.join('.');
    if (FIELD_PATH.test(path)) {
      setError(
        path as Parameters<typeof setError>[0],
        { message: error.code satisfies ProductErrorCode },
        { shouldFocus: isFirstFieldError },
      );
      isFirstFieldError = false;
    } else {
      withoutField.push(error);
    }
  }
  return withoutField;
}
