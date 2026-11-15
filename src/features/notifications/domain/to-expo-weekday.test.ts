import { toExpoWeekday } from './to-expo-weekday';

describe('toExpoWeekday', () => {
  test.each([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 1],
  ] as const)('ISO %p is Expo %p', (iso, expo) => {
    expect(toExpoWeekday(iso)).toBe(expo);
  });
});
