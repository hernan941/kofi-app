import type { EpochMs } from '@/shared/domain';

import { isExportFileName, safetyFileName } from '../domain/file-names';
import type { BackupFiles, SafetyBackupInfo, SafetyTarget } from '../domain/ports';

/** `BackupFiles` sin disco: arma URIs ficticias y registra cada llamada. */
export class FakeBackupFiles implements BackupFiles {
  readonly exportTargets: string[] = [];
  readonly sweeps: { now: EpochMs; minAgeMs: number }[] = [];
  readonly discarded: string[] = [];
  readonly events: string[] = [];
  clearedEmergency = 0;
  readonly promotedSafety: SafetyTarget[] = [];
  readonly prunedSafety: string[] = [];
  sweepRemoved = 0;
  sweepFailure: Error | null = null;
  safety: SafetyBackupInfo | null = null;

  exportTarget(fileName: string): string {
    if (!isExportFileName(fileName)) {
      throw new Error('The export file name is not allowed.');
    }
    const uri = `file:///fake/cache/backups/${fileName}`;
    this.exportTargets.push(uri);
    return uri;
  }

  safetyTarget(createdAt: EpochMs): SafetyTarget {
    const finalUri = `file:///fake/doc/safety/${safetyFileName(createdAt)}`;
    return { partUri: `${finalUri}.part`, finalUri };
  }

  promoteSafety(target: SafetyTarget): Promise<void> {
    this.promotedSafety.push(target);
    return Promise.resolve();
  }

  pruneSafety(keepUri: string): Promise<void> {
    this.prunedSafety.push(keepUri);
    return Promise.resolve();
  }

  latestSafety(): SafetyBackupInfo | null {
    return this.safety;
  }

  restoreCopyTarget(): string {
    return 'file:///fake/cache/DocumentPicker/cuantovendi-copia-de-seguridad.zip';
  }

  emergencyDirectory(): string {
    return 'file:///fake/cache/emergency/';
  }

  clearEmergencyDirectory(): void {
    this.clearedEmergency += 1;
    this.events.push('clear');
  }

  discardPicked(uri: string): void {
    this.discarded.push(uri);
    this.events.push(`discard:${uri}`);
  }

  sweep(now: EpochMs, minAgeMs: number): Promise<{ readonly removed: number }> {
    this.sweeps.push({ now, minAgeMs });
    return this.sweepFailure === null
      ? Promise.resolve({ removed: this.sweepRemoved })
      : Promise.reject(this.sweepFailure);
  }
}
