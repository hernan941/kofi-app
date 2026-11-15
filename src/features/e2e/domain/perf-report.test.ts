import { formatPerfReport } from './perf-report';

describe('formatPerfReport', () => {
  it('writes one line per mark with name, detail and time, in order', () => {
    const report = formatPerfReport({
      marks: [
        { name: 'calendar:month:press', detail: '2026-10', atMs: 1500.25 },
        { name: 'home:ready', detail: undefined, atMs: 2100 },
      ],
      startup: null,
      heap: null,
    });

    expect(report.split('\n')).toEqual([
      'mark calendar:month:press 2026-10 1500.3',
      'mark home:ready - 2100.0',
    ]);
  });

  it('adds the native startup timestamps and the Hermes heap when the runtime has them', () => {
    const report = formatPerfReport({
      marks: [],
      startup: {
        startTime: 10,
        initializeRuntimeStart: 20,
        executeJavaScriptBundleEntryPointStart: 30.5,
        endTime: 40,
      },
      heap: { usedJSHeapSize: 1000, totalJSHeapSize: 2000 },
    });

    expect(report.split('\n')).toEqual([
      'startup startTime=10.0 initializeRuntimeStart=20.0 executeJavaScriptBundleEntryPointStart=30.5 endTime=40.0',
      'heap used=1000 total=2000',
    ]);
  });

  it('says there are no marks instead of returning an empty text', () => {
    expect(formatPerfReport({ marks: [], startup: null, heap: null })).toBe('sin marcas');
  });
});
