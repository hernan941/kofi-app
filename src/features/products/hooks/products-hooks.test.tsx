import { act, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import type { TableName } from '@/core/db/table-names';
import { DataChangesBridge } from '@/core/providers/query/data-changes-bridge';
import { QUERY_DEPENDENCIES } from '@/core/providers/query/query-dependencies';
import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { productIdSchema, type Clp } from '@/shared/domain';

import type { Product } from '../domain';
import {
  PRODUCT_ID,
  fixtureId,
  makeProduct,
  makeVersion,
} from '../domain/testing/product-fixtures';
import type { SaveProductCommand } from '../use-cases/save-product';
import type { SetProductArchivedCommand } from '../use-cases/set-product-archived';
import { useActiveProducts } from './use-active-products';
import { useArchivedProducts } from './use-archived-products';
import { useProduct } from './use-product';
import { useSaveProduct } from './use-save-product';
import { useSetProductArchived } from './use-set-product-archived';
import { useVersionIdsWithSales } from './use-version-ids-with-sales';

function ActiveList() {
  const { data, isPending, isError } = useActiveProducts();
  if (isPending) return <Text>cargando</Text>;
  if (isError) return <Text>falló</Text>;
  if (data.length === 0) return <Text>vacío</Text>;
  return <Text>{data.map((product) => product.name).join(',')}</Text>;
}

function mount(element: React.ReactElement, dependencies: TestDependencies) {
  return renderWithProviders(
    <>
      <DataChangesBridge dataChanges={dependencies.dataChanges} dependencies={QUERY_DEPENDENCIES} />
      {element}
    </>,
    { dependencies },
  );
}

async function runMutation<T>(mutate: () => Promise<T>): Promise<T> {
  let outcome: { readonly value: T } | undefined;
  await act(async () => {
    try {
      outcome = { value: await mutate() };
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  if (outcome === undefined) {
    throw new Error('The mutation did not resolve.');
  }
  return outcome.value;
}

const named = (name: string, n: number): Product => {
  const id = productIdSchema.parse(fixtureId(n));
  return makeProduct([makeVersion(n, { productId: id })], { name, id });
};

describe('useActiveProducts', () => {
  it('shows the loading state first and then the empty state', async () => {
    await mount(<ActiveList />, createTestDependencies());

    expect(screen.getByText('cargando')).toBeOnTheScreen();
    expect(await screen.findByText('vacío')).toBeOnTheScreen();
  });

  it('shows the products sorted for the list', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save(named('Taza', 3));
    await dependencies.products.save(named('Álbum', 2));
    await dependencies.products.save(named('Lámina', 4));

    await mount(<ActiveList />, dependencies);

    expect(await screen.findByText('Álbum,Lámina,Taza')).toBeOnTheScreen();
  });

  it('shows the error state when the repository fails', async () => {
    const dependencies = createTestDependencies();
    const failing = {
      ...dependencies.products,
      listActive: () => Promise.reject(new Error('boom')),
    };

    await mount(<ActiveList />, createTestDependencies({ products: failing }));

    expect(await screen.findByText('falló')).toBeOnTheScreen();
  });
});

describe('read hooks', () => {
  function Reads() {
    const archived = useArchivedProducts();
    const found = useProduct(PRODUCT_ID);
    const missing = useProduct(named('x', 9).id);
    const withSales = useVersionIdsWithSales(PRODUCT_ID);
    return (
      <Text>
        {[
          archived.data?.map((product) => product.name).join(',') ?? '-',
          found.data?.name ?? '-',
          missing.isSuccess && missing.data === null ? 'null' : '-',
          withSales.data ? [...withSales.data].length : '-',
        ].join('|')}
      </Text>
    );
  }

  it('reads archived products, a product by id (null when missing) and the versions with sales', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save(makeProduct([makeVersion(0)], { name: 'Lámina' }));
    await dependencies.products.save(named('Vieja', 5));
    await dependencies.products.setArchived(
      named('Vieja', 5).id,
      makeProduct([]).createdAt,
      makeProduct([]).createdAt,
    );
    dependencies.products.addSale({ productId: PRODUCT_ID, versionId: makeVersion(0).id });

    await mount(<Reads />, dependencies);

    expect(await screen.findByText('Vieja|Lámina|null|1')).toBeOnTheScreen();
  });
});

describe('useSaveProduct', () => {
  const captured: { current?: ReturnType<typeof useSaveProduct> } = {};

  function Saver() {
    const mutation = useSaveProduct();
    useEffect(() => {
      captured.current = mutation;
    });
    return null;
  }

  const latest = () => {
    if (captured.current === undefined) {
      throw new Error('The hook has not rendered.');
    }
    return captured.current;
  };

  const create = (name: string): SaveProductCommand => ({
    kind: 'create',
    input: {
      name,
      description: null,
      versions: [{ name: null, pricing: { mode: 'fixed', price: 1000 as Clp }, cost: null }],
    },
  });

  it('resolves with the domain errors instead of throwing', async () => {
    await mount(<Saver />, createTestDependencies());
    const command = create('Lámina');
    const twoUnnamed: SaveProductCommand = {
      kind: 'create',
      input: {
        ...(command.kind === 'create' ? command.input : { name: '', description: null }),
        versions: [
          { name: null, pricing: { mode: 'negotiable' }, cost: null },
          { name: null, pricing: { mode: 'negotiable' }, cost: null },
        ],
      },
    };

    const result = await runMutation(() => latest().mutateAsync(twoUnnamed));

    expect(result).toEqual({
      ok: false,
      error: [
        { code: 'version_name_required', path: ['versions', 0, 'name'] },
        { code: 'version_name_required', path: ['versions', 1, 'name'] },
      ],
    });
  });

  it('rejects and logs an unexpected error', async () => {
    const dependencies = createTestDependencies();
    const failing = {
      ...dependencies.productWriter,
      saveSync: () => {
        throw new Error('disk full');
      },
    };
    const withFailure = createTestDependencies({ ...dependencies, productWriter: failing });
    await mount(<Saver />, withFailure);

    await expect(runMutation(() => latest().mutateAsync(create('Lámina')))).rejects.toThrow(
      'disk full',
    );

    expect(withFailure.logger.entriesAt('error').map((entry) => entry.event)).toEqual([
      'save_product_failed',
    ]);
  });

  it('refreshes a mounted list after saving, without invalidating by hand', async () => {
    const dependencies = createTestDependencies();
    await mount(
      <>
        <ActiveList />
        <Saver />
      </>,
      dependencies,
    );
    await screen.findByText('vacío');

    await runMutation(() => latest().mutateAsync(create('Lámina')));

    expect(await screen.findByText('Lámina')).toBeOnTheScreen();
  });
});

describe('useSetProductArchived', () => {
  const captured: { current?: ReturnType<typeof useSetProductArchived> } = {};

  const latest = () => {
    if (captured.current === undefined) {
      throw new Error('The hook has not rendered.');
    }
    return captured.current;
  };

  function Archiver() {
    const mutation = useSetProductArchived();
    useEffect(() => {
      captured.current = mutation;
    });
    return null;
  }

  it('archives the product and the mounted lists follow', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save(makeProduct([makeVersion(0)], { name: 'Lámina' }));
    await mount(
      <>
        <ActiveList />
        <Archiver />
      </>,
      dependencies,
    );
    await screen.findByText('Lámina');
    const command: SetProductArchivedCommand = { productId: PRODUCT_ID, archived: true };

    const result = await runMutation(() => latest().mutateAsync(command));

    expect(result.ok).toBe(true);
    expect(await screen.findByText('vacío')).toBeOnTheScreen();
  });

  it('resolves with product_not_found for a missing product', async () => {
    await mount(<Archiver />, createTestDependencies());

    const result = await runMutation(() =>
      latest().mutateAsync({ productId: named('x', 9).id, archived: true }),
    );

    expect(result).toEqual({ ok: false, error: [{ code: 'product_not_found', path: [] }] });
  });
});

describe('invalidation by table', () => {
  it('reloads the version usage on a sale but not the product list', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save(makeProduct([makeVersion(0)], { name: 'Lámina' }));
    const listActive = jest.spyOn(dependencies.products, 'listActive');
    const versionIdsWithSales = jest.spyOn(dependencies.products, 'versionIdsWithSales');
    function Both() {
      useActiveProducts();
      useVersionIdsWithSales(PRODUCT_ID);
      return <Text>listo</Text>;
    }
    await mount(<Both />, dependencies);
    await waitFor(() => {
      expect(versionIdsWithSales).toHaveBeenCalledTimes(1);
    });

    await act(() => {
      dependencies.dataChanges.emit(new Set<TableName>(['sale_items']));
    });

    await waitFor(() => {
      expect(versionIdsWithSales).toHaveBeenCalledTimes(2);
    });
    expect(listActive).toHaveBeenCalledTimes(1);
  });
});
