import type { TableName } from '@/core/db/table-names';

import { at, tipId } from '../domain/testing/tip-fixtures';
import type { TipViewRepository } from './tip-view-repository';

/** Lo que la suite de contrato necesita de cada implementación. */
export interface TipViewRepositoryHarness {
  readonly repository: TipViewRepository;
  /** Un elemento por cada `DataChanges` emitido desde que se creó el harness. */
  readonly emitted: ReadonlySet<TableName>[];
  dispose(): void;
}

const T0 = at(1_700_000_000_000);
const T1 = at(1_700_000_100_000);
const T2 = at(1_700_000_200_000);
const FIRST = tipId('costos-tu-tiempo');
const SECOND = tipId('registro-primera-venta');

/** Suite de contrato de los consejos vistos; la corren Drizzle y el doble en memoria. */
export function runTipViewRepositoryContract(
  createHarness: () => Promise<TipViewRepositoryHarness> | TipViewRepositoryHarness,
): void {
  let harness: TipViewRepositoryHarness;
  let repository: TipViewRepository;

  beforeEach(async () => {
    harness = await createHarness();
    repository = harness.repository;
  });

  afterEach(() => {
    harness.dispose();
  });

  it('lists nothing when no tip was seen', async () => {
    await expect(repository.listAll()).resolves.toEqual([]);
  });

  it('creates the view on the first mark with both instants equal to now', async () => {
    await repository.markSeen(FIRST, T0);

    await expect(repository.listAll()).resolves.toEqual([
      { tipId: FIRST, firstSeenAt: T0, lastSeenAt: T0 },
    ]);
  });

  it('keeps first_seen_at and advances the last seen instant on a later mark', async () => {
    await repository.markSeen(FIRST, T0);

    await repository.markSeen(FIRST, T2);

    await expect(repository.listAll()).resolves.toEqual([
      { tipId: FIRST, firstSeenAt: T0, lastSeenAt: T2 },
    ]);
  });

  it('never moves the last seen instant backwards', async () => {
    await repository.markSeen(FIRST, T2);

    await repository.markSeen(FIRST, T0);

    await expect(repository.listAll()).resolves.toEqual([
      { tipId: FIRST, firstSeenAt: T2, lastSeenAt: T2 },
    ]);
  });

  it('lists every seen tip, each with its own instants', async () => {
    await repository.markSeen(FIRST, T0);
    await repository.markSeen(SECOND, T1);

    const views = await repository.listAll();

    expect([...views].sort((a, b) => (a.tipId < b.tipId ? -1 : 1))).toEqual([
      { tipId: FIRST, firstSeenAt: T0, lastSeenAt: T0 },
      { tipId: SECOND, firstSeenAt: T1, lastSeenAt: T1 },
    ]);
  });

  it('emits only tip_views once per mark, even when nothing moves, and never on reads', async () => {
    await repository.markSeen(FIRST, T1);
    await repository.markSeen(FIRST, T0);
    await repository.listAll();

    expect(harness.emitted).toEqual([new Set(['tip_views']), new Set(['tip_views'])]);
  });
}
