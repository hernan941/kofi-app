import { RecordingLogger } from './recording-logger';

describe('RecordingLogger', () => {
  test('records every level with its event, error and context', () => {
    const logger = new RecordingLogger();
    const failure = new Error('boom');

    logger.info('started');
    logger.warn('slow', { ms: 900 });
    logger.error('failed', failure, { step: 3 });

    expect(logger.entries).toEqual([
      { level: 'info', event: 'started' },
      { level: 'warn', event: 'slow', context: { ms: 900 } },
      { level: 'error', event: 'failed', error: failure, context: { step: 3 } },
    ]);
  });

  test('filters entries by level', () => {
    const logger = new RecordingLogger();
    logger.info('a');
    logger.error('b', new Error('x'));

    expect(logger.entriesAt('error').map((entry) => entry.event)).toEqual(['b']);
  });
});
