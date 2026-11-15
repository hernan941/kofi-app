const { parseBlocks, metricsOf, summarize, renderTable } = require('./parse-marks');

const LOG = [
  'noise before',
  'PERFMARKS_BEGIN p3-calendar',
  'mark tab:press calendar 1000.0',
  'mark calendar:ready 2026-11 1450.0',
  'mark calendar:month:press 2026-10 2000.0',
  'mark calendar:month:ready 2026-10 2210.5',
  'mark calendar:month:press 2024-10 3000.0',
  'mark calendar:month:ready 2024-10 3400.0',
  'heap used=30000000 total=50000000',
  'PERFMARKS_END',
  'PERFMARKS_BEGIN p1-startup',
  'mark boot:migrate:start - 900.0',
  'mark boot:migrate:end - 960.0',
  'mark home:ready - 2400.0',
  'startup startTime=100.0 initializeRuntimeStart=150.0 executeJavaScriptBundleEntryPointStart=600.0 endTime=700.0',
  'PERFMARKS_END',
].join('\n');

describe('parseBlocks', () => {
  it('extracts every block of a Maestro log with its flow name, marks, startup and heap', () => {
    const blocks = parseBlocks(LOG);

    expect(blocks.map(({ flow }) => flow)).toEqual(['p3-calendar', 'p1-startup']);
    expect(blocks[0].marks).toHaveLength(6);
    expect(blocks[0].marks[0]).toEqual({ name: 'tab:press', detail: 'calendar', atMs: 1000 });
    expect(blocks[0].heap).toEqual({ used: 30000000, total: 50000000 });
    expect(blocks[1].startup.startTime).toBe(100);
  });

  it('ignores blocks without marks', () => {
    expect(parseBlocks('PERFMARKS_BEGIN x\nsin marcas\nPERFMARKS_END')[0].marks).toEqual([]);
  });
});

describe('metricsOf', () => {
  it('measures the calendar from the tab press and each month from its own press', () => {
    const [calendar] = parseBlocks(LOG);

    expect(metricsOf(calendar)).toEqual(
      expect.arrayContaining([
        { id: 'P3.a', value: 450 },
        { id: 'P3.b', value: 210.5 },
        { id: 'P3.b', value: 400 },
        { id: 'P7.d', value: 30000000 },
      ]),
    );
  });

  it('measures the startup from the native start time and the migration by its marks', () => {
    const [, startup] = parseBlocks(LOG);

    expect(metricsOf(startup)).toEqual(
      expect.arrayContaining([
        { id: 'P1.b', value: 2300 },
        { id: 'P1.c', value: 1800 },
        { id: 'P1.d', value: 60 },
      ]),
    );
  });
});

describe('summarize', () => {
  it('reports median and maximum per budget against its threshold', () => {
    const rows = summarize([
      { id: 'P3.b', value: 100 },
      { id: 'P3.b', value: 200 },
      { id: 'P3.b', value: 600 },
    ]);

    expect(rows).toEqual([
      { id: 'P3.b', runs: 3, median: 200, max: 600, medianLimit: 300, maxLimit: 500, ok: false },
    ]);
  });

  it('passes when both the median and the maximum are inside the thresholds', () => {
    const [row] = summarize([{ id: 'P2.a', value: 400 }]);

    expect(row.ok).toBe(true);
  });

  it('uses the mean of the two middle values as the median of an even count', () => {
    const [row] = summarize([
      { id: 'P4.a', value: 100 },
      { id: 'P4.a', value: 300 },
    ]);

    expect(row.median).toBe(200);
  });
});

describe('renderTable', () => {
  it('writes the session table of the performance budgets, section 7', () => {
    const table = renderTable(summarize([{ id: 'P2.e', value: 450 }]));

    expect(table).toContain('| Presupuesto | Corridas | Mediana | Máx. | Umbral | Resultado |');
    expect(table).toContain('| P2.e | 1 | 450.0 | 450.0 | 500 / 800 | ok |');
  });
});
