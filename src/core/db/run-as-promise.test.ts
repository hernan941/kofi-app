import { runAsPromise } from './run-as-promise';

describe('runAsPromise', () => {
  it('resolves with the value of the work', async () => {
    await expect(runAsPromise(() => 7)).resolves.toBe(7);
  });

  it('turns an exception into a rejection instead of throwing', async () => {
    let pending: Promise<number> | undefined;

    expect(() => {
      pending = runAsPromise(() => {
        throw new Error('boom');
      });
    }).not.toThrow();

    await expect(pending).rejects.toThrow('boom');
  });
});
