import { SafeAreaView } from 'react-native-safe-area-context';

import { StyledSafeAreaView } from './styled-safe-area-view';

jest.mock('uniwind', () => ({
  withUniwind: (component: unknown) => ({ wrapped: component }),
}));

describe('StyledSafeAreaView', () => {
  it('binds className to the safe area view, which Uniwind does not style by itself', () => {
    expect(StyledSafeAreaView).toEqual({ wrapped: SafeAreaView });
  });
});
