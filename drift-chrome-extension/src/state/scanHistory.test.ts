import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import {
  addScan,
  capRecords,
  clearHistoryForPr,
  getHistory,
  getHistoryForPr,
  removeScan,
  MAX_PER_PR,
  MAX_TOTAL,
  type ScanRecord,
} from './scanHistory';
import { emptyReport } from '../core/types';

function rec(url: string, ts: number, sha = `${ts}`): ScanRecord {
  return {
    id: `${url}@${sha}@${ts}`,
    url,
    owner: 'o',
    repo: 'r',
    number: Number(url.split('/').pop()),
    title: 't',
    sha,
    ts,
    durationMs: 100,
    caption: 'cap',
    verdict: 'review',
    verdictLabel: 'Reviewed',
    report: emptyReport(),
    scan: { pr_review: {} },
    narration: 'n',
    changedFiles: 3,
  };
}

const PR = (n: number) => `https://github.com/o/r/pull/${n}`;

describe('scanHistory cap logic', () => {
  it('sorts newest-first', () => {
    const out = capRecords([rec(PR(1), 100), rec(PR(1), 300), rec(PR(1), 200)]);
    expect(out.map((r) => r.ts)).toEqual([300, 200, 100]);
  });

  it('keeps at most MAX_PER_PR scans for one PR', () => {
    const many = Array.from({ length: MAX_PER_PR + 5 }, (_, i) => rec(PR(1), i + 1));
    const out = capRecords(many);
    expect(out).toHaveLength(MAX_PER_PR);
    // The newest are kept.
    expect(out[0].ts).toBe(MAX_PER_PR + 5);
  });

  it('bounds the total across PRs at MAX_TOTAL', () => {
    const all: ScanRecord[] = [];
    // Enough distinct PRs (each within per-PR cap) to exceed the global cap.
    for (let pr = 0; pr < MAX_TOTAL + 10; pr++) all.push(rec(PR(pr), pr + 1));
    expect(capRecords(all)).toHaveLength(MAX_TOTAL);
  });
});

describe('scanHistory persistence', () => {
  beforeEach(() => installChromeMock());

  it('addScan stores newest-first and getHistoryForPr filters by url', async () => {
    await addScan(rec(PR(1), 100));
    await addScan(rec(PR(2), 150));
    await addScan(rec(PR(1), 200));

    const all = await getHistory();
    expect(all.map((r) => r.ts)).toEqual([200, 150, 100]);

    const forPr1 = await getHistoryForPr(PR(1));
    expect(forPr1.map((r) => r.ts)).toEqual([200, 100]);
    expect(forPr1.every((r) => r.url === PR(1))).toBe(true);
  });

  it('removeScan drops one record by id', async () => {
    const r = rec(PR(1), 100);
    await addScan(r);
    await addScan(rec(PR(1), 200));
    const left = await removeScan(r.id);
    expect(left.map((x) => x.ts)).toEqual([200]);
  });

  it('clearHistoryForPr removes only that PR', async () => {
    await addScan(rec(PR(1), 100));
    await addScan(rec(PR(2), 200));
    await clearHistoryForPr(PR(1));
    expect(await getHistoryForPr(PR(1))).toEqual([]);
    expect(await getHistoryForPr(PR(2))).toHaveLength(1);
  });

  it('enforces the per-PR cap as scans accumulate', async () => {
    for (let i = 1; i <= MAX_PER_PR + 3; i++) await addScan(rec(PR(1), i));
    const forPr = await getHistoryForPr(PR(1));
    expect(forPr).toHaveLength(MAX_PER_PR);
    expect(forPr[0].ts).toBe(MAX_PER_PR + 3); // newest survives
  });
});
