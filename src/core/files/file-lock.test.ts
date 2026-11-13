import { createFileLock } from './file-lock';

describe('createFileLock', () => {
  test('starts free', () => {
    expect(createFileLock().isHeld()).toBe(false);
  });

  test('tryAcquire takes a free lock and reports its owner', () => {
    const lock = createFileLock();
    const lease = lock.tryAcquire('photo_removal');
    expect(lease?.owner).toBe('photo_removal');
    expect(lock.isHeld()).toBe(true);
  });

  test('tryAcquire returns null while the lock is taken', () => {
    const lock = createFileLock();
    lock.tryAcquire('backup_export');
    expect(lock.tryAcquire('orphan_collection')).toBeNull();
  });

  test('release frees the lock, and releasing twice has no further effect', () => {
    const lock = createFileLock();
    const first = lock.tryAcquire('photo_removal');
    first?.release();
    const second = lock.tryAcquire('orphan_collection');
    first?.release();
    expect(second).not.toBeNull();
    expect(lock.isHeld()).toBe(true);
  });

  test('acquire resolves at once when the lock is free', async () => {
    const lock = createFileLock();
    const lease = await lock.acquire('backup_restore');
    expect(lease.owner).toBe('backup_restore');
    expect(lock.isHeld()).toBe(true);
  });

  test('acquire waits in arrival order', async () => {
    const lock = createFileLock();
    const order: string[] = [];
    const held = lock.tryAcquire('photo_removal');
    const first = lock.acquire('backup_export').then((lease) => {
      order.push('first');
      return lease;
    });
    const second = lock.acquire('backup_restore').then((lease) => {
      order.push('second');
      return lease;
    });
    await Promise.resolve();
    expect(order).toEqual([]);
    held?.release();
    (await first).release();
    (await second).release();
    expect(order).toEqual(['first', 'second']);
    expect(lock.isHeld()).toBe(false);
  });

  test('a waiting acquire keeps the lock taken when the holder releases', async () => {
    const lock = createFileLock();
    const held = lock.tryAcquire('photo_removal');
    const waiting = lock.acquire('backup_export');
    held?.release();
    expect(lock.isHeld()).toBe(true);
    expect(lock.tryAcquire('orphan_collection')).toBeNull();
    (await waiting).release();
    expect(lock.isHeld()).toBe(false);
  });

  test('whenReleased runs at once when the lock is free', () => {
    const task = jest.fn();
    createFileLock().whenReleased(task);
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('whenReleased runs after the release when the lock is taken', () => {
    const lock = createFileLock();
    const task = jest.fn();
    const lease = lock.tryAcquire('backup_restore');
    lock.whenReleased(task);
    expect(task).not.toHaveBeenCalled();
    lease?.release();
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('whenReleased waits until queued acquirers are done', async () => {
    const lock = createFileLock();
    const task = jest.fn();
    const held = lock.tryAcquire('photo_removal');
    const waiting = lock.acquire('backup_export');
    lock.whenReleased(task);
    held?.release();
    expect(task).not.toHaveBeenCalled();
    (await waiting).release();
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('a throwing task does not stop the release nor the other tasks', () => {
    const lock = createFileLock();
    const later = jest.fn();
    const lease = lock.tryAcquire('backup_restore');
    lock.whenReleased(() => {
      throw new Error('boom');
    });
    lock.whenReleased(later);
    expect(() => lease?.release()).not.toThrow();
    expect(later).toHaveBeenCalledTimes(1);
    expect(lock.isHeld()).toBe(false);
  });

  test('a task that takes the lock again defers the tasks that follow it', () => {
    const lock = createFileLock();
    const calls: string[] = [];
    const lease = lock.tryAcquire('backup_restore');
    let retaken: ReturnType<typeof lock.tryAcquire> = null;
    lock.whenReleased(() => {
      retaken = lock.tryAcquire('photo_removal');
      calls.push('first');
    });
    lock.whenReleased(() => calls.push('second'));
    lease?.release();
    expect(calls).toEqual(['first']);
    expect((retaken as ReturnType<typeof lock.tryAcquire>)?.owner).toBe('photo_removal');
    (retaken as ReturnType<typeof lock.tryAcquire>)?.release();
    expect(calls).toEqual(['first', 'second']);
  });
});
