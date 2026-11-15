import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(__dirname, '..', '..');
const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.test\.(ts|tsx)$/;
const BARE_LEXEND_IMPORT = /from\s+'@expo-google-fonts\/lexend'/;

function sourceFiles(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }
    return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) ? [entryPath] : [];
  });
}

describe('Lexend font imports (F10.2, P8.c)', () => {
  it('never import the package index, which bundles all nine .ttf files', () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      BARE_LEXEND_IMPORT.test(fs.readFileSync(file, 'utf8')),
    );

    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });
});
