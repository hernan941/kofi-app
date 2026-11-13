import { err, ok, type ProductId, type ProductPhotoId, type Result } from '@/shared/domain';

import {
  createProduct,
  diffPhotos,
  setProductPhotos,
  updateProduct,
  type CreateProductInput,
  type PhotoChangesInput,
  type Product,
  type ProductErrors,
  type UpdateProductInput,
} from '../domain';
import type { ProductCommandDeps } from './product-command-deps';
import { removePhotoFiles } from './remove-photo-files';

/** Crear o editar desde el formulario; `photos` es la lista deseada y `undefined` no las toca. */
export type SaveProductCommand =
  | {
      readonly kind: 'create';
      readonly input: CreateProductInput;
      readonly photos?: PhotoChangesInput;
    }
  | {
      readonly kind: 'update';
      readonly productId: ProductId;
      readonly input: UpdateProductInput;
      readonly photos?: PhotoChangesInput;
    };

/** Lo que la transacción informa al terminar bien. */
interface Saved {
  readonly id: ProductId;
  readonly removedPhotoIds: readonly ProductPhotoId[];
}

function applyPhotos(
  deps: ProductCommandDeps,
  before: Product | null,
  next: Product,
  photos: PhotoChangesInput | undefined,
): Result<Saved, ProductErrors> {
  if (photos === undefined) {
    deps.products.saveSync(next);
    return ok({ id: next.id, removedPhotoIds: [] });
  }
  const withPhotos = setProductPhotos(next, photos, deps.clock);
  if (!withPhotos.ok) {
    return withPhotos;
  }
  const previous = before?.photos ?? [];
  const diff = diffPhotos(previous, withPhotos.value.photos);
  deps.products.saveSync(withPhotos.value);
  deps.products.savePhotosSync(next.id, diff, deps.clock.now());
  return ok({ id: next.id, removedPhotoIds: diff.removed });
}

function create(
  deps: ProductCommandDeps,
  command: Extract<SaveProductCommand, { kind: 'create' }>,
): Result<Saved, ProductErrors> {
  const result = createProduct(command.input, deps);
  return result.ok ? applyPhotos(deps, null, result.value, command.photos) : result;
}

function update(
  deps: ProductCommandDeps,
  command: Extract<SaveProductCommand, { kind: 'update' }>,
): Result<Saved, ProductErrors> {
  const current = deps.products.findByIdSync(command.productId);
  if (current === null) {
    return err([{ code: 'product_not_found', path: [] }]);
  }
  const result = updateProduct(current, command.input, {
    clock: deps.clock,
    ids: deps.ids,
    versionIdsWithSales: deps.products.versionIdsWithSalesSync(command.productId),
  });
  return result.ok ? applyPhotos(deps, current, result.value, command.photos) : result;
}

/**
 * Dentro de `transactions.run`: lee el producto y sus versiones con ventas (al editar),
 * aplica el comando puro, las fotos (`setProductPhotos` y `diffPhotos`) y guarda todo junto.
 * Si la transacción rechaza, relanza el error original sin borrar archivos: las fotos nuevas
 * pertenecen a la sesión del formulario, que las descarta al salir sin guardar o, si no,
 * la recolección de huérfanos. Si el dominio devuelve error, tampoco borra nada. Si hace commit, borra los archivos de las fotos quitadas con `removePhotoFiles`, que nunca rechaza.
 * Devuelve el id guardado o los errores del dominio.
 */
export async function saveProduct(
  deps: ProductCommandDeps,
  command: SaveProductCommand,
): Promise<Result<ProductId, ProductErrors>> {
  const result = await deps.transactions.run(() =>
    command.kind === 'create' ? create(deps, command) : update(deps, command),
  );
  if (!result.ok) {
    return result;
  }
  await removePhotoFiles(
    {
      photos: deps.photos,
      products: { activePhotoIds: () => Promise.resolve(deps.products.activePhotoIdsSync()) },
      fileLock: deps.fileLock,
      clock: deps.clock,
      logger: deps.logger,
    },
    result.value.removedPhotoIds,
  );
  return ok(result.value.id);
}
