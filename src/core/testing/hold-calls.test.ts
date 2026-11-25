import { holdCalls } from './hold-calls';

describe('holdCalls', () => {
  function makeRepository() {
    return { read: (id: number) => Promise.resolve(`value:${String(id)}`) };
  }

  it('keeps the calls pending until released and then resolves them with the real method', async () => {
    const repository = makeRepository();
    const release = holdCalls(repository, 'read');
    const settled = jest.fn();

    const result = repository.read(1).then((value) => {
      settled();
      return value;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(settled).not.toHaveBeenCalled();

    release();

    await expect(result).resolves.toBe('value:1');
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('lets calls made after the release through without waiting', async () => {
    const repository = makeRepository();
    const release = holdCalls(repository, 'read');
    release();

    await expect(repository.read(2)).resolves.toBe('value:2');
  });
});
