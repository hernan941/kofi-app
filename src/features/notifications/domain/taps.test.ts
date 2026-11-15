import { createTapDeduplicator } from './taps';

describe('createTapDeduplicator', () => {
  it('accepts a key the first time and rejects it afterwards', () => {
    const deduplicator = createTapDeduplicator();

    expect(deduplicator.isNew('cv.weekly.repeat@100')).toBe(true);
    expect(deduplicator.isNew('cv.weekly.repeat@100')).toBe(false);
  });

  it('treats the same identifier with another delivery date as a new tap', () => {
    const deduplicator = createTapDeduplicator();

    expect(deduplicator.isNew('cv.weekly.repeat@100')).toBe(true);
    expect(deduplicator.isNew('cv.weekly.repeat@700')).toBe(true);
  });

  it('forgets the oldest keys once the limit is passed', () => {
    const deduplicator = createTapDeduplicator(2);
    deduplicator.isNew('a');
    deduplicator.isNew('b');
    deduplicator.isNew('c');

    expect(deduplicator.isNew('a')).toBe(true);
    expect(deduplicator.isNew('c')).toBe(false);
  });
});
