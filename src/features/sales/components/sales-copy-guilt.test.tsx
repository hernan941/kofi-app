import { screen, userEvent } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { clpSchema, saleRecordIdSchema, weekRangeOf } from '@/shared/domain';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';
import { renderUi } from '@/shared/ui/testing/render-ui';

import type { NoSalesPrompt } from '../domain';
import { date, fixtureId } from '../domain/testing/sale-fixtures';
import type { SaleSavedOutcome } from '../use-cases/save-sale-record';
import { NoSalesPanel } from './no-sales-panel';
import { NoSalesSection } from './no-sales-section';
import { SaleSavedCelebration } from './sale-saved-celebration';

const user = userEvent.setup();

const TODAY = date('2026-11-13');
const current = weekRangeOf(TODAY);
const previous = weekRangeOf(date('2026-11-06'));

interface CopyElement {
  readonly props: { readonly accessibilityLabel?: unknown };
  readonly children: readonly CopyNode[] | null;
}
type CopyNode = CopyElement | string;

/** Every string the user can read or hear in the rendered tree: text and accessibility labels. */
function collectCopy(node: CopyNode | readonly CopyNode[] | null): string[] {
  if (node === null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap((child: CopyNode) => collectCopy(child));
  const element = node as CopyElement;
  const label = element.props.accessibilityLabel;
  return [...(typeof label === 'string' ? [label] : []), ...collectCopy(element.children)];
}

function expectNoGuilt(copy: readonly string[]) {
  expect(copy.length).toBeGreaterThan(0);
  for (const text of copy) {
    expect({ text, pattern: findGuiltPattern(text) }).toEqual({ text, pattern: null });
  }
}

const PROMPTS: readonly NoSalesPrompt[] = [
  { kind: 'single', week: current, which: 'current' },
  { kind: 'single', week: previous, which: 'previous' },
  { kind: 'choose', previous, current, preselected: 'previous' },
  { kind: 'marked', week: current },
  { kind: 'has_sales', week: current },
];

const outcome = (overrides: Partial<SaleSavedOutcome>): SaleSavedOutcome => ({
  kind: 'created',
  recordId: saleRecordIdSchema.parse(fixtureId(4, 1)),
  soldOn: TODAY,
  isFirstSale: false,
  clearedNoSalesWeek: null,
  ...overrides,
});

describe('sales copy has no guilt', () => {
  it.each(PROMPTS)('the "no vendí" panel for $kind', async (prompt) => {
    await renderUi(<NoSalesPanel prompt={prompt} onMark={jest.fn()} onUnmark={jest.fn()} />);

    expectNoGuilt(collectCopy(screen.toJSON()));
  });

  it.each([
    ['a regular sale', outcome({})],
    ['the first sale', outcome({ isFirstSale: true })],
    ['an edit', outcome({ kind: 'updated' })],
    ['a sale that clears this week mark', outcome({ clearedNoSalesWeek: current.start })],
    ['a sale that clears another week mark', outcome({ clearedNoSalesWeek: previous.start })],
  ])('the celebration for %s', async (_name, saleOutcome) => {
    await renderUi(
      <SaleSavedCelebration
        outcome={saleOutcome}
        total={clpSchema.parse(45000)}
        productCount={3}
        today={TODAY}
        onDone={jest.fn()}
      />,
    );

    expectNoGuilt(collectCopy(screen.toJSON()));
  });

  it('the toasts of marking, unmarking and failing to mark', async () => {
    const dependencies = createTestDependencies();
    await renderWithProviders(<NoSalesSection />, { dependencies, observeDataChanges: true });

    await user.press(await screen.findByRole('button', { name: 'Esta semana no vendí' }));
    await screen.findByText('Marcaste que esta semana no vendiste.');
    const afterMark = collectCopy(screen.toJSON());
    await user.press(screen.getByRole('button', { name: 'Desmarcar' }));
    await screen.findByRole('button', { name: 'Esta semana no vendí' });
    const afterUnmark = collectCopy(screen.toJSON());
    jest.spyOn(dependencies.noSalesWeeks, 'markSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    await user.press(screen.getByRole('button', { name: 'Esta semana no vendí' }));
    await screen.findAllByText('No se pudo marcar. Inténtalo de nuevo.', {
      includeHiddenElements: true,
    });
    const afterFailure = collectCopy(screen.toJSON());

    expect(afterMark).toContain('Listo, anotamos que esta semana no vendiste.');
    expect(afterUnmark).toContain('Quitamos la marca de esta semana.');
    expectNoGuilt([...afterMark, ...afterUnmark, ...afterFailure]);
  });
});
