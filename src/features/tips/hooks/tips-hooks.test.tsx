import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import type { SaleChannel } from '@/features/sales/domain';
import { saleRecordIdSchema, type SaleRecordId } from '@/shared/domain';

import {
  date,
  fixtureId,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
  clp,
} from '../../sales/domain/testing/sale-fixtures';
import type { Tip, TipId } from '../domain';
import { at, makeTip, tipId } from '../domain/testing/tip-fixtures';
import { createFixtureTipCatalog } from '../testing/fixture-tip-catalog';
import { useMarkTipSeen } from './use-mark-tip-seen';
import { useTip } from './use-tip';
import { useTipAfterSale } from './use-tip-after-sale';
import { useTipSections } from './use-tip-sections';

const user = userEvent.setup();

function MarkButton({ id }: { readonly id: TipId }) {
  const { mutate } = useMarkTipSeen();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        mutate(id);
      }}
    >
      <Text>marcar</Text>
    </Pressable>
  );
}

const RECORD = saleRecordIdSchema.parse(fixtureId(4, 1));

const COST_TIP = makeTip('costos-uno', { category: 'costs', trigger: 'no_costs' });
const FIRST_TIP = makeTip('primera-venta', { category: 'recording', trigger: 'first_sale' });
const FAIR_TIP = makeTip('en-feria', { category: 'fairs', trigger: 'fair_sale' });
const STREAK_TIP = makeTip('en-racha', { category: 'pricing', trigger: 'streak' });
const PLAIN_TIP = makeTip('sin-contexto', { category: 'social_media' });
const CATALOG: readonly Tip[] = [COST_TIP, FIRST_TIP, FAIR_TIP, STREAK_TIP, PLAIN_TIP];

function setup(overrides: Partial<TestDependencies> = {}): TestDependencies {
  return createTestDependencies({ tipCatalog: createFixtureTipCatalog(CATALOG), ...overrides });
}

function withCosts(dependencies: TestDependencies): void {
  dependencies.products.saveSync(makeProduct(1, [makeVersion(1, { cost: clp(300) })]));
}

function saveRecord(
  dependencies: TestDependencies,
  soldOn: string,
  channel: SaleChannel | null,
  id: SaleRecordId = RECORD,
): void {
  dependencies.sales.saveSync(
    makeSaleRecord([makeSaleItem(1)], { id, soldOn: date(soldOn), channel }),
  );
}

function AfterSaleProbe({ isFirstSale }: { readonly isFirstSale: boolean }) {
  const query = useTipAfterSale({ recordId: RECORD, isFirstSale });
  if (query.isPending) {
    return <Text>pending</Text>;
  }
  if (query.isError) {
    return <Text>error</Text>;
  }
  return <Text>{query.data?.id ?? 'none'}</Text>;
}

describe('useTipAfterSale', () => {
  it('uses the channel of the record that was just saved', async () => {
    const dependencies = setup();
    withCosts(dependencies);
    saveRecord(dependencies, '2026-07-01', 'fair');

    await renderWithProviders(<AfterSaleProbe isFirstSale={false} />, { dependencies });

    expect(await screen.findByText(FAIR_TIP.id)).toBeOnTheScreen();
  });

  it('prefers the cost tip on a first sale when no costs are loaded', async () => {
    const dependencies = setup();
    saveRecord(dependencies, '2026-07-01', 'other');

    await renderWithProviders(<AfterSaleProbe isFirstSale />, { dependencies });

    expect(await screen.findByText(COST_TIP.id)).toBeOnTheScreen();
  });

  it('picks the first-sale tip on a first sale once costs are loaded', async () => {
    const dependencies = setup();
    withCosts(dependencies);
    saveRecord(dependencies, '2026-07-01', 'other');

    await renderWithProviders(<AfterSaleProbe isFirstSale />, { dependencies });

    expect(await screen.findByText(FIRST_TIP.id)).toBeOnTheScreen();
  });

  it('counts the streak including the week of the saved sale', async () => {
    const dependencies = setup();
    withCosts(dependencies);
    saveRecord(dependencies, '2026-07-01', 'other');
    saveRecord(dependencies, '2026-06-24', 'other', saleRecordIdSchema.parse(fixtureId(4, 2)));
    saveRecord(dependencies, '2026-06-17', 'other', saleRecordIdSchema.parse(fixtureId(4, 3)));

    await renderWithProviders(<AfterSaleProbe isFirstSale={false} />, { dependencies });

    expect(await screen.findByText(STREAK_TIP.id)).toBeOnTheScreen();
  });

  it('chooses nothing when the record does not exist', async () => {
    const dependencies = setup();

    await renderWithProviders(<AfterSaleProbe isFirstSale={false} />, { dependencies });

    expect(await screen.findByText('none')).toBeOnTheScreen();
  });

  it('fails when the seen tips cannot be read', async () => {
    const dependencies = setup();
    saveRecord(dependencies, '2026-07-01', null);
    jest.spyOn(dependencies.tipViews, 'listAll').mockRejectedValue(new Error('disk'));

    await renderWithProviders(<AfterSaleProbe isFirstSale={false} />, { dependencies });

    expect(await screen.findByText('error')).toBeOnTheScreen();
    expect(
      dependencies.logger.entries.some((entry) => entry.event === 'after_sale_tip_failed'),
    ).toBe(true);
  });

  it('keeps the same choice after marking it seen', async () => {
    const dependencies = setup();
    withCosts(dependencies);
    saveRecord(dependencies, '2026-07-01', 'fair');
    const listAll = jest.spyOn(dependencies.tipViews, 'listAll');
    const committed = jest.fn();
    dependencies.dataChanges.subscribe(committed);
    await renderWithProviders(
      <>
        <AfterSaleProbe isFirstSale={false} />
        <MarkButton id={FAIR_TIP.id} />
      </>,
      { dependencies, observeDataChanges: true },
    );
    await screen.findByText(FAIR_TIP.id);

    await user.press(screen.getByRole('button', { name: 'marcar' }));

    await waitFor(() => {
      expect(committed).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(FAIR_TIP.id)).toBeOnTheScreen();
    expect(listAll).toHaveBeenCalledTimes(1);
  });
});

describe('useMarkTipSeen', () => {
  it('records the tip with the current instant', async () => {
    const dependencies = setup();
    await renderWithProviders(<MarkButton id={PLAIN_TIP.id} />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'marcar' }));

    const now = dependencies.clock.now();
    await waitFor(async () => {
      await expect(dependencies.tipViews.listAll()).resolves.toEqual([
        { tipId: PLAIN_TIP.id, firstSeenAt: now, lastSeenAt: now },
      ]);
    });
  });

  it('logs a failure instead of surfacing it', async () => {
    const dependencies = setup();
    jest.spyOn(dependencies.tipViews, 'markSeen').mockRejectedValue(new Error('disk'));
    await renderWithProviders(<MarkButton id={PLAIN_TIP.id} />, { dependencies });

    await user.press(screen.getByRole('button', { name: 'marcar' }));

    await waitFor(() => {
      expect(
        dependencies.logger.entries.some((entry) => entry.event === 'mark_tip_seen_failed'),
      ).toBe(true);
    });
  });
});

function SectionsProbe({ showWhenFailed = false }: { readonly showWhenFailed?: boolean }) {
  const { status, sections } = useTipSections();
  if (status === 'pending' || (status === 'error' && !showWhenFailed)) {
    return <Text>{status}</Text>;
  }
  return (
    <>
      {sections.flatMap((section) =>
        section.items.map((item) => (
          <Text key={item.tip.id}>{`${item.tip.id}:${item.seen ? 'seen' : 'new'}`}</Text>
        )),
      )}
    </>
  );
}

describe('useTipSections', () => {
  it('lists every tip and marks the seen ones', async () => {
    const dependencies = setup();
    await dependencies.tipViews.markSeen(FAIR_TIP.id, at(5));

    await renderWithProviders(<SectionsProbe />, { dependencies });

    expect(await screen.findByText(`${FAIR_TIP.id}:seen`)).toBeOnTheScreen();
    expect(screen.getAllByText(/:new$/)).toHaveLength(CATALOG.length - 1);
  });

  it('updates when a tip is marked seen', async () => {
    const dependencies = setup();
    await renderWithProviders(<SectionsProbe />, { dependencies, observeDataChanges: true });
    await screen.findByText(`${PLAIN_TIP.id}:new`);

    await act(async () => {
      await dependencies.tipViews.markSeen(PLAIN_TIP.id, at(5));
    });

    expect(await screen.findByText(`${PLAIN_TIP.id}:seen`)).toBeOnTheScreen();
  });

  it('reports an error when the views cannot be read', async () => {
    const dependencies = setup();
    jest.spyOn(dependencies.tipViews, 'listAll').mockRejectedValue(new Error('disk'));

    await renderWithProviders(<SectionsProbe />, { dependencies });

    expect(await screen.findByText('error')).toBeOnTheScreen();
  });

  it('still offers every tip, none marked, when the views cannot be read', async () => {
    const dependencies = setup();
    jest.spyOn(dependencies.tipViews, 'listAll').mockRejectedValue(new Error('disk'));

    await renderWithProviders(<SectionsProbe showWhenFailed />, { dependencies });

    expect(await screen.findAllByText(/:new$/)).toHaveLength(CATALOG.length);
  });
});

function TipProbe({ id }: { readonly id: string }) {
  const { status, tip, seen } = useTip(tipId(id));
  if (status !== 'ready') {
    return <Text>{status}</Text>;
  }
  return <Text>{tip === null ? 'unknown' : `${tip.id}:${seen ? 'seen' : 'new'}`}</Text>;
}

describe('useTip', () => {
  it('finds a tip and whether it was seen', async () => {
    const dependencies = setup();
    await dependencies.tipViews.markSeen(PLAIN_TIP.id, at(5));

    await renderWithProviders(<TipProbe id={PLAIN_TIP.id} />, { dependencies });

    expect(await screen.findByText(`${PLAIN_TIP.id}:seen`)).toBeOnTheScreen();
  });

  it('is unknown when the id is not in the catalog', async () => {
    await renderWithProviders(<TipProbe id="no-existe" />, { dependencies: setup() });

    expect(await screen.findByText('unknown')).toBeOnTheScreen();
  });
});
