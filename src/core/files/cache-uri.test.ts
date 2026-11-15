import { isCacheUri, uriScheme } from './cache-uri';

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///data/cache/' } },
}));

describe('isCacheUri', () => {
  it('accepts files under the cache directory', () => {
    expect(isCacheUri('file:///data/cache/ImagePicker/a.jpg')).toBe(true);
  });

  it('rejects the document directory, other schemes and the cache directory itself', () => {
    expect(isCacheUri('file:///data/doc/photos/a.jpg')).toBe(false);
    expect(isCacheUri('content://media/a.jpg')).toBe(false);
    expect(isCacheUri('file:///data/cache/')).toBe(false);
    expect(isCacheUri('file:///data/cache-other/a.jpg')).toBe(false);
  });

  it('rejects paths that climb out of the cache directory', () => {
    expect(isCacheUri('file:///data/cache/../doc/photos/a.jpg')).toBe(false);
    expect(isCacheUri('file:///data/cache/%2e%2e/doc/a.jpg')).toBe(false);
  });

  it.each([
    'file:///data/cache/.%2e/doc/a.jpg',
    'file:///data/cache/%2e./doc/a.jpg',
    'file:///data/cache/%2E%2E/doc/a.jpg',
    'file:///data/cache/..%2fdoc/a.jpg',
    'file:///data/cache/a/..%5cdoc/a.jpg',
    'file:///data/cache/%2e%2e',
  ])('rejects the encoded climb %s', (uri) => {
    expect(isCacheUri(uri)).toBe(false);
  });

  it('rejects a URI that cannot be decoded', () => {
    expect(isCacheUri('file:///data/cache/%E0%A4%A/a.jpg')).toBe(false);
  });

  it('accepts names that only contain dots or encoded characters', () => {
    expect(isCacheUri('file:///data/cache/DocumentPicker/mi%20respaldo..zip')).toBe(true);
    expect(isCacheUri('file:///data/cache/DocumentPicker/...')).toBe(true);
  });
});

describe('uriScheme', () => {
  it('returns the lowercase scheme and nothing else', () => {
    expect(uriScheme('FILE:///data/doc/a.jpg')).toBe('file');
    expect(uriScheme('content://media/a')).toBe('content');
  });

  it('returns unknown when there is no scheme', () => {
    expect(uriScheme('/data/doc/a.jpg')).toBe('unknown');
  });
});
