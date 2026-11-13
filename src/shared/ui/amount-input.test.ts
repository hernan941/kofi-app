import { nextAmountText } from './amount-input';

describe('nextAmountText', () => {
  it.each([
    ['', '1', '1'],
    ['1', '15', '15'],
    ['1.500', '1.5000', '15.000'],
    ['15.000', '15.0001', '150.001'],
    ['150.001', '150.00', '15.000'],
    ['', '0', '0'],
    ['0', '05', '5'],
    ['', '1500000', '1.500.000'],
    ['', '$ 15.000', '15.000'],
  ])('after %p, typing %p shows %p', (previous, next, expected) => {
    expect(nextAmountText(previous, next)).toBe(expected);
  });

  it.each(['1.5', '15,5', '-500', 'abc', '1.50.0'])(
    'keeps a pasted %p untouched so validation can explain it',
    (pasted) => {
      expect(nextAmountText('', pasted)).toBe(pasted);
    },
  );

  it.each([
    ['1', '1.5'],
    ['15', '1.55'],
    ['1.5', '1.50'],
    ['1.500', '1.5.00'],
  ])(
    'does not swallow the point when %p becomes %p, leaving a malformed grouping',
    (previous, next) => {
      expect(nextAmountText(previous, next)).toBe(next);
    },
  );

  it('regroups a typed digit when the previous text is well grouped', () => {
    expect(nextAmountText('15.000', '15.0000')).toBe('150.000');
  });

  it('clears the field', () => {
    expect(nextAmountText('15.000', '')).toBe('');
  });
});
