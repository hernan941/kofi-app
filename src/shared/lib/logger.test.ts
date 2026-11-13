import { createLogger } from './logger';

function spyOnConsole() {
  return {
    info: jest.spyOn(console, 'info').mockImplementation(() => undefined),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    error: jest.spyOn(console, 'error').mockImplementation(() => undefined),
  };
}

describe('createLogger in production', () => {
  test('does not call console at any level', () => {
    const spies = spyOnConsole();
    const logger = createLogger(false);

    logger.info('app_started');
    logger.warn('slow_query', { ms: 900 });
    logger.error('migration_failed', new Error('boom'), { step: 3 });

    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
  });
});

describe('createLogger in development', () => {
  test('writes info and warn events with their context', () => {
    const spies = spyOnConsole();
    const logger = createLogger(true);

    logger.info('app_started', { version: 1 });
    logger.warn('slow_query', { ms: 900 });

    expect(spies.info).toHaveBeenCalledWith('app_started', { version: 1 });
    expect(spies.warn).toHaveBeenCalledWith('slow_query', { ms: 900 });
  });

  test('writes errors with the error and context', () => {
    const spies = spyOnConsole();
    const failure = new Error('boom');

    createLogger(true).error('migration_failed', failure, { step: 3 });

    expect(spies.error).toHaveBeenCalledWith('migration_failed', failure, { step: 3 });
  });

  test('omits the context when there is none', () => {
    const spies = spyOnConsole();

    createLogger(true).info('app_started');

    expect(spies.info).toHaveBeenCalledWith('app_started');
  });
});
