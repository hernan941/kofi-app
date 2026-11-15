import { screen, userEvent } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import { makeTip, tipId } from '../domain/testing/tip-fixtures';
import { bundledTipCatalog } from '../domain/catalog';
import { createFixtureTipCatalog } from '../testing/fixture-tip-catalog';
import { TipsScreen } from './tips-screen';

const user = userEvent.setup();

const TIPS = [
  makeTip('costos-uno', { category: 'costs', title: 'Cuenta tu tiempo' }),
  makeTip('registro-uno', { category: 'recording', title: 'Anota cada venta' }),
];

function setup(tips = TIPS) {
  return createTestDependencies({ tipCatalog: createFixtureTipCatalog(tips) });
}

const INTRODUCTION =
  'Ideas breves para llevar tu negocio. Cada vez que registras una venta, te mostramos una.';

/** Tipo y estilo de cada elemento desde el texto de introducción hasta la raíz. */
function introductionAncestry(): readonly unknown[] {
  const chain: unknown[] = [];
  for (let node = screen.getByText(INTRODUCTION).parent; node !== null; node = node.parent) {
    chain.push({
      type: node.type,
      style: node.props.style as unknown,
      className: node.props.className as unknown,
    });
  }
  return chain;
}

/** Todos los textos que dibuja la pantalla. */
function drawnTexts(): readonly string[] {
  const texts: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      texts.push(node);
    } else if (typeof node === 'object' && node !== null && 'children' in node) {
      const { children } = node;
      if (Array.isArray(children)) {
        children.forEach(visit);
      }
    }
  };
  visit(screen.toJSON());
  return texts;
}

describe('TipsScreen', () => {
  it('shows its title and the introduction', async () => {
    await renderWithProviders(<TipsScreen onOpenTip={jest.fn()} />, { dependencies: setup() });

    await screen.findByRole('button', { name: /^Anota cada venta/ });

    expect(screen.getByRole('header', { name: 'Consejos' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Ideas breves para llevar tu negocio. Cada vez que registras una venta, te mostramos una.',
      ),
    ).toBeOnTheScreen();
  });

  it('draws the header the same while loading and once the list is there', async () => {
    const dependencies = setup();
    let release: (views: []) => void = () => undefined;
    jest.spyOn(dependencies.tipViews, 'listAll').mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    await renderWithProviders(<TipsScreen onOpenTip={jest.fn()} />, { dependencies });
    const whileLoading = introductionAncestry();

    release([]);
    await screen.findByRole('button', { name: /^Anota cada venta/ });

    expect(whileLoading.length).toBeGreaterThan(1);
    expect(introductionAncestry()).toEqual(whileLoading);
  });

  it('shows the six categories of the real catalog in order', async () => {
    const dependencies = createTestDependencies({ tipCatalog: bundledTipCatalog });

    await renderWithProviders(<TipsScreen onOpenTip={jest.fn()} />, { dependencies });

    await screen.findByRole('header', { name: 'Registro' });
    expect(
      screen
        .getAllByRole('header')
        .map((header) => header.props.children as string)
        .slice(1),
    ).toEqual(['Registro', 'Costos', 'Precios', 'Ferias', 'Redes', 'Flujo de dinero']);
  });

  it('marks the seen tips and leaves the others without a mark', async () => {
    const dependencies = setup();
    await dependencies.tipViews.markSeen(tipId('costos-uno'), dependencies.clock.now());

    await renderWithProviders(<TipsScreen onOpenTip={jest.fn()} />, { dependencies });

    expect(
      await screen.findByRole('button', { name: 'Cuenta tu tiempo, Costos, visto' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Anota cada venta, Registro' })).toBeOnTheScreen();
    expect(screen.getAllByText('Visto', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.queryByText('Nuevo')).not.toBeOnTheScreen();
  });

  it('opens a tip', async () => {
    const onOpenTip = jest.fn();
    await renderWithProviders(<TipsScreen onOpenTip={onOpenTip} />, { dependencies: setup() });

    await user.press(await screen.findByRole('button', { name: 'Anota cada venta, Registro' }));

    expect(onOpenTip).toHaveBeenCalledWith(tipId('registro-uno'));
  });

  it('shows a loading state while it reads which tips were seen', async () => {
    const dependencies = setup();
    jest.spyOn(dependencies.tipViews, 'listAll').mockReturnValue(new Promise(() => undefined));

    await renderWithProviders(<TipsScreen onOpenTip={jest.fn()} />, { dependencies });

    expect(screen.getByLabelText('Cargando consejos')).toBeOnTheScreen();
    expect(screen.queryByText('Cuenta tu tiempo')).not.toBeOnTheScreen();
  });

  it('still lists every tip, without marks, when the seen ones cannot be read', async () => {
    const dependencies = setup();
    jest.spyOn(dependencies.tipViews, 'listAll').mockRejectedValue(new Error('disk'));

    await renderWithProviders(<TipsScreen onOpenTip={jest.fn()} />, { dependencies });

    expect(
      await screen.findByText('No pudimos revisar cuáles ya leíste. Igual puedes leerlos todos.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cuenta tu tiempo, Costos' })).toBeOnTheScreen();
    expect(screen.queryByText('Visto')).not.toBeOnTheScreen();
  });

  it('invites to come back when the catalog is empty', async () => {
    await renderWithProviders(<TipsScreen onOpenTip={jest.fn()} />, { dependencies: setup([]) });

    expect(await screen.findByText('Aquí vas a encontrar consejos')).toBeOnTheScreen();
    expect(
      screen.getByText('Pronto vas a tener ideas para tu negocio en esta sección.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('has no guilt in any text it draws', async () => {
    const dependencies = setup();
    jest.spyOn(dependencies.tipViews, 'listAll').mockRejectedValue(new Error('disk'));
    await renderWithProviders(<TipsScreen onOpenTip={jest.fn()} />, { dependencies });
    await screen.findByText(/No pudimos revisar/);

    expect(drawnTexts().length).toBeGreaterThan(3);
    for (const text of drawnTexts()) {
      expect(findGuiltPattern(text)).toBeNull();
    }
  });

  it('has no guilt in the empty state', async () => {
    await renderWithProviders(<TipsScreen onOpenTip={jest.fn()} />, { dependencies: setup([]) });
    await screen.findByText('Aquí vas a encontrar consejos');

    for (const text of drawnTexts()) {
      expect(findGuiltPattern(text)).toBeNull();
    }
  });
});
