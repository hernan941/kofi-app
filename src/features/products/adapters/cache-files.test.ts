import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { deleteCacheFile, isCacheUri, sweepStaleCacheFiles } from './cache-files';

interface MockEntry {
  lastModified: number | null;
}

const mockState = {
  entries: new Map<string, MockEntry>(),
  directories: new Set<string>(),
  deleteFailures: new Set<string>(),
};

jest.mock('expo-file-system', () => {
  function join(parts: readonly unknown[]): string {
    const segments = parts.map((part) =>
      typeof part === 'string' ? part : (part as { uri: string }).uri,
    );
    return segments.reduce((acc, segment, index) =>
      index === 0 ? segment : `${acc.replace(/\/+$/, '')}/${segment.replace(/^\/+/, '')}`,
    );
  }

  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockState.entries.has(this.uri);
    }
    get lastModified() {
      return mockState.entries.get(this.uri)?.lastModified ?? null;
    }
    delete() {
      if (mockState.deleteFailures.has(this.uri)) {
        throw new Error('delete failed');
      }
      mockState.entries.delete(this.uri);
    }
  }

  class MockDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockState.directories.has(this.uri);
    }
    list() {
      const prefix = `${this.uri.replace(/\/+$/, '')}/`;
      return [...mockState.entries.keys()]
        .filter((uri) => uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/'))
        .map((uri) => new MockFile(uri));
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      get cache() {
        return new MockDirectory('file:///data/cache/');
      },
    },
  };
});

const PICKER_DIR = 'file:///data/cache/ImagePicker';
const MANIPULATOR_DIR = 'file:///data/cache/ImageManipulator';
const NOW = 10_000_000;
const MIN_AGE = 900_000;

function put(uri: string, lastModified: number | null = 1000): void {
  mockState.entries.set(uri, { lastModified });
}

beforeEach(() => {
  mockState.entries.clear();
  mockState.directories.clear();
  mockState.deleteFailures.clear();
});

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
});

describe('deleteCacheFile', () => {
  it('deletes a file under the cache', () => {
    put(`${PICKER_DIR}/a.jpg`);

    deleteCacheFile(`${PICKER_DIR}/a.jpg`, new RecordingLogger());

    expect(mockState.entries.size).toBe(0);
  });

  it('never deletes a file outside the cache and logs it', () => {
    const logger = new RecordingLogger();
    put('file:///data/doc/photos/a.jpg');

    deleteCacheFile('file:///data/doc/photos/a.jpg', logger);

    expect(mockState.entries.size).toBe(1);
    expect(logger.entriesAt('warn').map((entry) => entry.event)).toEqual([
      'photo_temp_outside_cache',
    ]);
  });

  it('tolerates a missing file', () => {
    const logger = new RecordingLogger();

    deleteCacheFile(`${PICKER_DIR}/missing.jpg`, logger);

    expect(logger.entriesAt('warn')).toEqual([]);
  });

  it('logs a failed deletion instead of throwing', () => {
    const logger = new RecordingLogger();
    put(`${PICKER_DIR}/a.jpg`);
    mockState.deleteFailures.add(`${PICKER_DIR}/a.jpg`);

    expect(() => {
      deleteCacheFile(`${PICKER_DIR}/a.jpg`, logger);
    }).not.toThrow();
    expect(logger.entriesAt('warn').map((entry) => entry.event)).toEqual([
      'photo_temp_cleanup_failed',
    ]);
  });
});

describe('sweepStaleCacheFiles', () => {
  const options = { now: NOW, minAgeMs: MIN_AGE };

  it('deletes files of both folders older than the minimum age', () => {
    mockState.directories.add(PICKER_DIR).add(MANIPULATOR_DIR);
    put(`${PICKER_DIR}/old.jpg`, NOW - MIN_AGE - 1);
    put(`${MANIPULATOR_DIR}/old.jpg`, NOW - MIN_AGE - 1);

    const removed = sweepStaleCacheFiles(new RecordingLogger(), options);

    expect(removed).toBe(2);
    expect(mockState.entries.size).toBe(0);
  });

  it('keeps recent files, the exact limit and files without a readable time', () => {
    mockState.directories.add(PICKER_DIR);
    put(`${PICKER_DIR}/recent.jpg`, NOW - 1000);
    put(`${PICKER_DIR}/limit.jpg`, NOW - MIN_AGE);
    put(`${PICKER_DIR}/unknown.jpg`, null);

    const removed = sweepStaleCacheFiles(new RecordingLogger(), options);

    expect(removed).toBe(0);
    expect(mockState.entries.size).toBe(3);
  });

  it('does nothing when the folders do not exist', () => {
    expect(sweepStaleCacheFiles(new RecordingLogger(), options)).toBe(0);
  });

  it('keeps going after a failed deletion', () => {
    const logger = new RecordingLogger();
    mockState.directories.add(PICKER_DIR);
    put(`${PICKER_DIR}/a.jpg`, 1);
    put(`${PICKER_DIR}/b.jpg`, 1);
    mockState.deleteFailures.add(`${PICKER_DIR}/a.jpg`);

    const removed = sweepStaleCacheFiles(logger, options);

    expect(removed).toBe(1);
    expect(mockState.entries.has(`${PICKER_DIR}/b.jpg`)).toBe(false);
  });
});
