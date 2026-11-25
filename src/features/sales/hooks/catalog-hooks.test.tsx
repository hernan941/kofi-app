import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { holdCalls } from '@/core/testing/hold-calls';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { saleRecordIdSchema, type ProductId, type SaleRecordId } from '@/shared/domain';

import {
  date,
  fixtureId,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
  productId,
} from '../domain/testing/sale-fixtures';
import { useProductsByIds } from './use-products-by-ids';
import { useSaleRecordView } from './use-sale-record-view';
import { useSellableProducts } from './use-sellable-products';

function recordId(n: number): SaleRecordId {
  return saleRecordIdSchema.parse(fixtureId(4, n));
}

function seedCatalog(dependencies: TestDependencies): void {
  dependencies.products.saveSync(makeProduct(1, [makeVersion(1)], { name: 'Lámina' }));
}

describe('useProductsByIds', () => {
  function Names({ ids }: { ids: readonly ProductId[] }) {
    const { data, isPending } = useProductsByIds(ids);
    if (isPending) return <Text>cargando</Text>;
    return <Text>{`names:${data?.map((product) => product.name).join(',') ?? ''}`}</Text>;
  }

  it('reads products in any state, including archived ones, and skips unknown ids', async () => {
    const dependencies = createTestDependencies();
    dependencies.products.saveSync(makeProduct(1, [makeVersion(1)], { name: 'Lámina' }));
    dependencies.products.saveSync(
      makeProduct(2, [makeVersion(2, { productN: 2 })], {
        name: 'Taza',
        archivedAt: dependencies.clock.now(),
      }),
    );

    await renderWithProviders(<Names ids={[productId(1), productId(2), productId(9)]} />, {
      dependencies,
    });

    expect(await screen.findByText('names:Lámina,Taza')).toBeOnTheScreen();
  });

  it('resolves to an empty list without ids', async () => {
    await renderWithProviders(<Names ids={[]} />);

    expect(await screen.findByText('names:')).toBeOnTheScreen();
  });
});

describe('useSellableProducts', () => {
  function Sellable() {
    const { data, isPending, isError } = useSellableProducts();
    if (isPending) return <Text>cargando</Text>;
    if (isError) return <Text>falló</Text>;
    return <Text>{`sellable:${data?.map((product) => product.name).join(',') ?? ''}`}</Text>;
  }

  it('shows loading first and then the products ordered for the list', async () => {
    const dependencies = createTestDependencies();
    dependencies.products.saveSync(makeProduct(1, [makeVersion(1)], { name: 'Taza' }));
    dependencies.products.saveSync(
      makeProduct(2, [makeVersion(2, { productN: 2 })], { name: 'Álbum' }),
    );

    const release = holdCalls(dependencies.products, 'listActive');
    await renderWithProviders(<Sellable />, { dependencies });

    expect(screen.getByText('cargando')).toBeOnTheScreen();
    release();
    expect(await screen.findByText('sellable:Álbum,Taza')).toBeOnTheScreen();
  });

  it('leaves out archived products', async () => {
    const dependencies = createTestDependencies();
    dependencies.products.saveSync(makeProduct(1, [makeVersion(1)], { name: 'Lámina' }));
    dependencies.products.saveSync(
      makeProduct(2, [makeVersion(2, { productN: 2 })], {
        name: 'Taza',
        archivedAt: dependencies.clock.now(),
      }),
    );

    await renderWithProviders(<Sellable />, { dependencies });

    expect(await screen.findByText('sellable:Lámina')).toBeOnTheScreen();
  });

  it('leaves out products without any active version', async () => {
    const dependencies = createTestDependencies();
    dependencies.products.saveSync(
      makeProduct(1, [makeVersion(1, { archivedAt: dependencies.clock.now() })], {
        name: 'Sin versión',
      }),
    );
    dependencies.products.saveSync(
      makeProduct(2, [makeVersion(2, { productN: 2 })], { name: 'Taza' }),
    );

    await renderWithProviders(<Sellable />, { dependencies });

    expect(await screen.findByText('sellable:Taza')).toBeOnTheScreen();
  });
});

describe('useSaleRecordView', () => {
  function View({ id }: { id: SaleRecordId }) {
    const { status, view } = useSaleRecordView(id);
    if (view === null) return <Text>{`status:${status}`}</Text>;
    return (
      <Text>
        {`status:${status} total:${String(view.total)} ` +
          view.items
            .map((item) => `${item.productName ?? '?'}|${String(item.isArchived)}`)
            .join(',')}
      </Text>
    );
  }

  it('is pending while loading', async () => {
    const dependencies = createTestDependencies();
    seedCatalog(dependencies);

    const release = holdCalls(dependencies.sales, 'findById');
    await renderWithProviders(<View id={recordId(1)} />, { dependencies });

    expect(screen.getByText('status:pending')).toBeOnTheScreen();
    release();
    expect(await screen.findByText('status:not_found')).toBeOnTheScreen();
  });

  it('is not_found for an unknown id', async () => {
    await renderWithProviders(<View id={recordId(7)} />);

    expect(await screen.findByText('status:not_found')).toBeOnTheScreen();
  });

  it('combines the record with the current product names', async () => {
    const dependencies = createTestDependencies();
    seedCatalog(dependencies);
    dependencies.sales.saveSync(
      makeSaleRecord([makeSaleItem(1, { quantity: 2 })], {
        id: recordId(1),
        soldOn: date('2026-07-01'),
      }),
    );

    await renderWithProviders(<View id={recordId(1)} />, { dependencies });

    expect(await screen.findByText('status:ready total:2000 Lámina|false')).toBeOnTheScreen();
  });

  it('marks the item of an archived product as archived', async () => {
    const dependencies = createTestDependencies();
    dependencies.products.saveSync(
      makeProduct(1, [makeVersion(1)], { name: 'Lámina', archivedAt: dependencies.clock.now() }),
    );
    dependencies.sales.saveSync(makeSaleRecord([makeSaleItem(1)], { id: recordId(1) }));

    await renderWithProviders(<View id={recordId(1)} />, { dependencies });

    expect(await screen.findByText('status:ready total:1000 Lámina|true')).toBeOnTheScreen();
  });

  it('reports an error when the record cannot be read', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.sales, 'findById').mockRejectedValue(new Error('boom'));

    await renderWithProviders(<View id={recordId(1)} />, { dependencies });

    expect(await screen.findByText('status:error')).toBeOnTheScreen();
  });
});
