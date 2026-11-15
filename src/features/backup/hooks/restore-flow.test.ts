import type { EpochMs } from '@/shared/domain';

import type { RestorePlan } from '../use-cases/prepare-restore';
import { INITIAL_RESTORE_FLOW, restoreFlow, type RestoreFlowState } from './restore-flow';

const PLAN = {
  sourceUri: 'file:///cache/a.zip',
  preview: {
    createdAt: 1 as EpochMs,
    products: 1,
    saleRecords: 2,
    activePhotos: 3,
    current: { products: 0, saleRecords: 0, activePhotos: 0 },
  },
} as unknown as RestorePlan;

const preview: RestoreFlowState = { status: 'preview', source: 'file', plan: PLAN };
const restoring: RestoreFlowState = {
  status: 'restoring',
  source: 'file',
  plan: PLAN,
  progress: null,
};

describe('restoreFlow', () => {
  it('starts idle', () => {
    expect(INITIAL_RESTORE_FLOW).toEqual({ status: 'idle' });
  });

  it('goes from idle to picking and back to idle when the picker is cancelled', () => {
    const picking = restoreFlow(INITIAL_RESTORE_FLOW, { type: 'pick' });
    expect(picking).toEqual({ status: 'picking' });

    expect(restoreFlow(picking, { type: 'pickCancelled' })).toEqual({ status: 'idle' });
  });

  it('inspects the file that was picked, remembering its name', () => {
    expect(restoreFlow({ status: 'picking' }, { type: 'inspect', source: 'file' })).toEqual({
      status: 'inspecting',
      source: 'file',
    });
  });

  it('inspects the safety backup straight from idle', () => {
    expect(restoreFlow({ status: 'idle' }, { type: 'inspect', source: 'safety' })).toEqual({
      status: 'inspecting',
      source: 'safety',
    });
  });

  it('shows the preview when the inspection succeeds', () => {
    expect(
      restoreFlow({ status: 'inspecting', source: 'file' }, { type: 'inspected', plan: PLAN }),
    ).toEqual(preview);
  });

  it('shows a problem when the inspection fails', () => {
    expect(
      restoreFlow(
        { status: 'inspecting', source: 'file' },
        { type: 'inspectFailed', problem: { code: 'not_a_backup' } },
      ),
    ).toEqual({
      status: 'failed',
      source: 'file',
      problem: { code: 'not_a_backup' },
      afterConfirm: false,
    });
  });

  it('shows a problem when the picker itself fails', () => {
    expect(
      restoreFlow({ status: 'picking' }, { type: 'inspectFailed', problem: 'unexpected' }),
    ).toEqual({ status: 'failed', source: 'file', problem: 'unexpected', afterConfirm: false });
  });

  it('discards the preview back to idle', () => {
    expect(restoreFlow(preview, { type: 'discard' })).toEqual({ status: 'idle' });
  });

  it('starts restoring only from the preview', () => {
    expect(restoreFlow(preview, { type: 'confirm' })).toEqual(restoring);
    expect(restoreFlow({ status: 'idle' }, { type: 'confirm' })).toEqual({ status: 'idle' });
    expect(restoreFlow(restoring, { type: 'confirm' })).toBe(restoring);
  });

  it('records the progress while restoring and ignores it otherwise', () => {
    const progress = { phase: 'copying_photos', done: 1, total: 2 } as const;

    expect(restoreFlow(restoring, { type: 'progress', progress })).toEqual({
      ...restoring,
      progress,
    });
    expect(restoreFlow({ status: 'idle' }, { type: 'progress', progress })).toEqual({
      status: 'idle',
    });
  });

  it('finishes with the preview that was restored', () => {
    expect(restoreFlow(restoring, { type: 'restored' })).toEqual({
      status: 'done',
      source: 'file',
      preview: PLAN.preview,
    });
  });

  it('fails after confirming and says so', () => {
    expect(restoreFlow(restoring, { type: 'restoreFailed', problem: 'unexpected' })).toEqual({
      status: 'failed',
      source: 'file',
      problem: 'unexpected',
      afterConfirm: true,
    });
  });

  it('goes back to idle from a problem or from the success', () => {
    const failed: RestoreFlowState = {
      status: 'failed',
      source: 'file',
      problem: 'unexpected',
      afterConfirm: false,
    };

    expect(restoreFlow(failed, { type: 'reset' })).toEqual({ status: 'idle' });
    expect(
      restoreFlow({ status: 'done', source: 'file', preview: PLAN.preview }, { type: 'reset' }),
    ).toEqual({ status: 'idle' });
  });

  it('can pick another file from a problem with a file', () => {
    const failed: RestoreFlowState = {
      status: 'failed',
      source: 'file',
      problem: { code: 'not_a_backup' },
      afterConfirm: false,
    };

    expect(restoreFlow(failed, { type: 'pick' })).toEqual({ status: 'picking' });
  });

  it('ignores events that do not fit the state', () => {
    expect(restoreFlow({ status: 'idle' }, { type: 'restored' })).toEqual({ status: 'idle' });
    expect(restoreFlow(preview, { type: 'pick' })).toBe(preview);
  });
});
