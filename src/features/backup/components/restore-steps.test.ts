import type { RestoreProgress } from '../domain/progress';
import { restoreStepStates, type RestoreStepState } from './restore-steps';

function statesOf(progress: RestoreProgress | null, hasPhotos = true): RestoreStepState[] {
  return restoreStepStates(progress, hasPhotos).map(({ state }) => state);
}

describe('restoreStepStates', () => {
  it('lists the four steps in order', () => {
    expect(restoreStepStates(null, true).map(({ step }) => step)).toEqual([
      'review',
      'safety',
      'photos',
      'apply',
    ]);
  });

  it('starts with the first step in progress before any phase arrives', () => {
    expect(statesOf(null)).toEqual(['current', 'pending', 'pending', 'pending']);
  });

  it.each([
    [{ phase: 'validating' }, ['current', 'pending', 'pending', 'pending']],
    [{ phase: 'checking_space' }, ['current', 'pending', 'pending', 'pending']],
    [{ phase: 'safety_backup', done: 1, total: 4 }, ['done', 'current', 'pending', 'pending']],
    [{ phase: 'copying_photos', done: 1, total: 4 }, ['done', 'done', 'current', 'pending']],
    [{ phase: 'applying' }, ['done', 'done', 'done', 'current']],
    [{ phase: 'finishing' }, ['done', 'done', 'done', 'current']],
  ] as const)('maps %j', (progress, expected) => {
    expect(statesOf(progress)).toEqual(expected);
  });

  it('leaves out the photos step when the backup has none', () => {
    expect(restoreStepStates(null, false).map(({ step }) => step)).toEqual([
      'review',
      'safety',
      'apply',
    ]);
    expect(statesOf({ phase: 'copying_photos', done: 0, total: 0 }, false)).toEqual([
      'done',
      'done',
      'current',
    ]);
    expect(statesOf({ phase: 'applying' }, false)).toEqual(['done', 'done', 'current']);
  });
});
