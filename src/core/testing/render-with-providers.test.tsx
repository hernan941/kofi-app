import { useQuery, useQueryClient } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { useDependencies } from '@/core/providers/dependencies-context';
import { makeProduct, makeVersion } from '@/features/sales/testing/sale-fixtures';

import { createTestDependencies } from './create-test-dependencies';
import { renderWithProviders } from './render-with-providers';

function Probe() {
  const { clock } = useDependencies();
  const client = useQueryClient();
  return <Text>{[String(clock.now()), String(client.isFetching())].join(' ')}</Text>;
}

describe('renderWithProviders', () => {
  test('mounts the element with the given dependencies and a fresh query client', async () => {
    const dependencies = createTestDependencies();

    await renderWithProviders(<Probe />, { dependencies });

    expect(screen.getByText(`${String(dependencies.clock.now())} 0`)).toBeOnTheScreen();
  });

  test('uses a new query client in each render', async () => {
    const clients: unknown[] = [];
    function Capture() {
      const client = useQueryClient();
      useEffect(() => {
        clients.push(client);
      }, [client]);
      return null;
    }

    await renderWithProviders(<Capture />);
    await renderWithProviders(<Capture />);

    expect(clients).toHaveLength(2);
    expect(clients[0]).not.toBe(clients[1]);
  });

  describe('observing data changes', () => {
    function ProductsCount() {
      const { products } = useDependencies();
      const { data } = useQuery({
        queryKey: ['products', 'probe'],
        queryFn: () => products.listActive(),
      });
      return <Text>{`products:${String(data?.length ?? '-')}`}</Text>;
    }

    test('reloads the queries of a root when its tables change', async () => {
      const dependencies = createTestDependencies();
      await renderWithProviders(<ProductsCount />, { dependencies, observeDataChanges: true });
      expect(await screen.findByText('products:0')).toBeOnTheScreen();

      await act(async () => {
        dependencies.products.saveSync(makeProduct(1, [makeVersion(1)]));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(await screen.findByText('products:1')).toBeOnTheScreen();
    });

    test('does not reload anything by default', async () => {
      const dependencies = createTestDependencies();
      await renderWithProviders(<ProductsCount />, { dependencies });
      expect(await screen.findByText('products:0')).toBeOnTheScreen();

      await act(async () => {
        dependencies.products.saveSync(makeProduct(1, [makeVersion(1)]));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByText('products:0')).toBeOnTheScreen();
    });
  });
});
