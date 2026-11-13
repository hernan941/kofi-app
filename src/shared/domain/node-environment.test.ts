describe('node project', () => {
  test('runs pure code', () => {
    expect([1, 2, 3].reduce((total, value) => total + value, 0)).toBe(6);
  });

  test('does not load React Native', () => {
    const loadReactNative = (): string[] => Object.keys(jest.requireActual<object>('react-native'));

    expect(loadReactNative).toThrow(/cannot be loaded in the `node` Jest project/);
  });

  test('does not load React Native subpaths either', () => {
    const loadSubpath = (): unknown =>
      jest.requireActual('react-native/Libraries/Core/Devtools/parseHermesStack');

    expect(loadSubpath).toThrow(/cannot be loaded in the `node` Jest project/);
  });
});
