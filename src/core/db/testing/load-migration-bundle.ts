import fs from 'node:fs';
import path from 'node:path';

import type { MigrationBundle } from '../configure-and-migrate';

interface JournalFile {
  readonly entries: MigrationBundle['journal']['entries'];
}

/**
 * Arma `{ journal, migrations }` con la misma forma que `migrations.js` de drizzle-kit, leyendo
 * `meta/_journal.json` y los `.sql` de la carpeta. Con `upToIndex` recorta el journal hasta esa
 * migración inclusive (`-1` deja un journal vacío), para los tests N-1 → N (ADR-006).
 */
export function loadMigrationBundle(
  folder: string,
  options: { readonly upToIndex?: number } = {},
): MigrationBundle {
  const journalPath = path.join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as JournalFile;
  const entries = journal.entries.filter(
    (entry) => options.upToIndex === undefined || entry.idx <= options.upToIndex,
  );
  const migrations: Record<string, string> = {};
  for (const entry of entries) {
    const key = `m${entry.idx.toString().padStart(4, '0')}`;
    migrations[key] = fs.readFileSync(path.join(folder, `${entry.tag}.sql`), 'utf8');
  }
  return { journal: { entries }, migrations };
}
