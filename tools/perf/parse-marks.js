const fs = require('node:fs');

const BEGIN = /^PERFMARKS_BEGIN\s+(\S+)/;
const END = /^PERFMARKS_END/;
const MARK_LINE = /^mark (\S+) (\S+) ([\d.]+)$/;
const NO_DETAIL = '-';
const HEAP_BYTES_PER_MB = 1_000_000;

/**
 * Thresholds of `docs/architecture/performance-budgets.md`, in milliseconds (P7.d in bytes):
 * `[median, maximum]`. Budgets with a single limit repeat it.
 */
const LIMITS = {
  'P1.b': [3500, 4500],
  'P1.c': [2000, 2000],
  'P1.d': [150, 150],
  'P2.a': [600, 1000],
  'P2.e': [500, 800],
  'P3.a': [600, 900],
  'P3.b': [300, 500],
  'P4.a': [600, 900],
  'P7.d': [64 * HEAP_BYTES_PER_MB, 64 * HEAP_BYTES_PER_MB],
};

/**
 * Parses one line of the `startup k=v ...` report into numbers.
 *
 * @param {string} line - The line without trailing spaces.
 * @returns {Record<string, number>} Startup timestamps by name.
 */
function parseStartup(line) {
  const entries = line
    .split(' ')
    .slice(1)
    .map((pair) => pair.split('='))
    .map(([key, value]) => [key, Number(value)]);
  return Object.fromEntries(entries);
}

/**
 * Extracts the blocks `PERFMARKS_BEGIN <flow>` ... `PERFMARKS_END` that `_dump-marks.yaml`
 * prints, from a Maestro log, ignoring everything else.
 *
 * @param {string} text - Log or output of the flow.
 * @returns {{ flow: string, marks: { name: string, detail: string | undefined, atMs: number }[], startup: Record<string, number> | null, heap: { used: number, total: number } | null }[]} One block per dump, in order.
 */
function parseBlocks(text) {
  const blocks = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const begin = BEGIN.exec(line);
    if (begin) {
      current = { flow: begin[1], marks: [], startup: null, heap: null };
    } else if (current && END.test(line)) {
      blocks.push(current);
      current = null;
    } else if (current) {
      const mark = MARK_LINE.exec(line);
      if (mark) {
        const detail = mark[2] === NO_DETAIL ? undefined : mark[2];
        current.marks.push({ name: mark[1], detail, atMs: Number(mark[3]) });
      } else if (line.startsWith('startup ')) {
        current.startup = parseStartup(line);
      } else if (line.startsWith('heap ')) {
        const values = parseStartup(line);
        current.heap = { used: values.used, total: values.total };
      }
    }
  }
  return blocks;
}

function firstMark(marks, name, detail) {
  return marks.find(
    (mark) => mark.name === name && (detail === undefined || mark.detail === detail),
  );
}

function pairDurations(marks, id, start, end) {
  return marks
    .filter(
      (mark) =>
        mark.name === start.name && (start.detail === undefined || mark.detail === start.detail),
    )
    .flatMap((press) => {
      const done = marks.find(
        (mark) =>
          mark.name === end.name &&
          mark.atMs >= press.atMs &&
          (end.sameDetail ? mark.detail === press.detail : true),
      );
      return done ? [{ id, value: Math.round((done.atMs - press.atMs) * 10) / 10 }] : [];
    });
}

/**
 * Computes the budget metrics of one block (see section 3 of the budgets document).
 *
 * @param {ReturnType<typeof parseBlocks>[number]} block - A parsed dump.
 * @returns {{ id: string, value: number }[]} One entry per measurement.
 */
function metricsOf(block) {
  const { marks, startup, heap } = block;
  const metrics = [];
  const homeReady = firstMark(marks, 'home:ready');
  if (homeReady && startup) {
    metrics.push({ id: 'P1.b', value: homeReady.atMs - startup.startTime });
    metrics.push({
      id: 'P1.c',
      value: homeReady.atMs - startup.executeJavaScriptBundleEntryPointStart,
    });
  }
  metrics.push(
    ...pairDurations(marks, 'P1.d', { name: 'boot:migrate:start' }, { name: 'boot:migrate:end' }),
    ...pairDurations(marks, 'P2.a', { name: 'sale-form:press' }, { name: 'sale-form:ready' }),
    ...pairDurations(
      marks,
      'P2.e',
      { name: 'sale:save:press' },
      { name: 'sale:celebration:visible' },
    ),
    ...pairDurations(
      marks,
      'P3.a',
      { name: 'tab:press', detail: 'calendar' },
      { name: 'calendar:ready' },
    ),
    ...pairDurations(
      marks,
      'P3.b',
      { name: 'calendar:month:press' },
      { name: 'calendar:month:ready', sameDetail: true },
    ),
    ...pairDurations(
      marks,
      'P4.a',
      { name: 'tab:press', detail: 'products' },
      { name: 'products:ready' },
    ),
  );
  if (heap) {
    metrics.push({ id: 'P7.d', value: heap.used });
  }
  return metrics.map(({ id, value }) => ({ id, value: Math.round(value * 10) / 10 }));
}

function median(sorted) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Groups the metrics by budget and reports median and maximum against the thresholds.
 *
 * @param {{ id: string, value: number }[]} metrics - Measurements of all the runs.
 * @returns {{ id: string, runs: number, median: number, max: number, medianLimit: number, maxLimit: number, ok: boolean }[]}
 *   Rows sorted by budget id.
 */
function summarize(metrics) {
  const ids = [...new Set(metrics.map(({ id }) => id))].sort();
  return ids.map((id) => {
    const values = metrics
      .filter((metric) => metric.id === id)
      .map(({ value }) => value)
      .sort((a, b) => a - b);
    const [medianLimit, maxLimit] = LIMITS[id];
    const med = median(values);
    const max = values[values.length - 1];
    return {
      id,
      runs: values.length,
      median: med,
      max,
      medianLimit,
      maxLimit,
      ok: med <= medianLimit && max <= maxLimit,
    };
  });
}

/**
 * Markdown table in the session format of section 7 of the budgets document.
 *
 * @param {ReturnType<typeof summarize>} rows - Rows from {@link summarize}.
 * @returns {string} The table.
 */
function renderTable(rows) {
  const lines = [
    '| Presupuesto | Corridas | Mediana | Máx. | Umbral | Resultado |',
    '|---|---|---|---|---|---|',
    ...rows.map((row) => {
      const limit =
        row.medianLimit === row.maxLimit
          ? String(row.medianLimit)
          : `${row.medianLimit} / ${row.maxLimit}`;
      return `| ${row.id} | ${row.runs} | ${row.median.toFixed(1)} | ${row.max.toFixed(1)} | ${limit} | ${row.ok ? 'ok' : 'no'} |`;
    }),
  ];
  return lines.join('\n');
}

/**
 * CLI: `node tools/perf/parse-marks.js <maestro-log>...` (or the log on stdin). Prints the
 * table with every dump found in the files, one run per dump.
 */
function main(argv) {
  const files = argv.slice(2);
  const text =
    files.length === 0
      ? fs.readFileSync(0, 'utf8')
      : files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const metrics = parseBlocks(text).flatMap(metricsOf);
  process.stdout.write(`${renderTable(summarize(metrics))}\n`);
}

if (require.main === module) {
  main(process.argv);
}

module.exports = { parseBlocks, metricsOf, summarize, renderTable };
