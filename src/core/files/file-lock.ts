import type { FileLock, FileLockLease, FileLockOwner } from '@/shared/domain/file-lock';

interface Waiter {
  readonly owner: FileLockOwner;
  readonly grant: (lease: FileLockLease) => void;
}

/**
 * Crea el lock de archivos en memoria (ADR-008, ADR-012): una sola instancia por proceso, sin
 * dependencias nativas. Los `acquire` pendientes se atienden por orden de llegada y las
 * tareas de `whenReleased` corren solo cuando no queda nadie con el lock ni esperándolo.
 */
export function createFileLock(): FileLock {
  let current: FileLockLease | null = null;
  const waiters: Waiter[] = [];
  const tasks: (() => void)[] = [];

  function runPendingTasks(): void {
    while (current === null) {
      const task = tasks.shift();
      if (task === undefined) {
        return;
      }
      try {
        task();
      } catch {
        continue;
      }
    }
  }

  function take(owner: FileLockOwner): FileLockLease {
    const lease: FileLockLease = {
      owner,
      release: () => {
        if (current === lease) {
          current = null;
          handOver();
        }
      },
    };
    current = lease;
    return lease;
  }

  function handOver(): void {
    const next = waiters.shift();
    if (next === undefined) {
      runPendingTasks();
      return;
    }
    next.grant(take(next.owner));
  }

  return {
    tryAcquire: (owner) => (current === null ? take(owner) : null),
    acquire: (owner) =>
      new Promise<FileLockLease>((resolve) => {
        if (current === null) {
          resolve(take(owner));
          return;
        }
        waiters.push({ owner, grant: resolve });
      }),
    isHeld: () => current !== null,
    whenReleased: (task) => {
      tasks.push(task);
      runPendingTasks();
    },
  };
}
