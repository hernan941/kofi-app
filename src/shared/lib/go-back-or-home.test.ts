import { goBackOrHome } from './go-back-or-home';

function createRouter(canGoBack: boolean) {
  return { canGoBack: jest.fn(() => canGoBack), back: jest.fn(), replace: jest.fn() };
}

describe('goBackOrHome', () => {
  it('goes back when there is history', () => {
    const router = createRouter(true);

    goBackOrHome(router);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces with the start when there is no history', () => {
    const router = createRouter(false);

    goBackOrHome(router);

    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });
});
