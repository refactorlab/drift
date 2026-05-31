// Dev-only: render a fixture through the real overview renderer and print it,
// so the PR comment can be eyeballed without a live PR. Not shipped.
import { join } from 'node:path';
import { loadReport } from '../src/report.ts';
import { renderOverview } from '../src/render/overview.ts';
import type { PrContext } from '../src/render/context.ts';

const fixtureDir = join(import.meta.dirname, '../.dev');
const which = process.argv[2] ?? 'kotlin';
const file = which === 'python' ? 'scan-pr-output.json' : 'scan-pr-output-kotlin-ktor.json';

const ctx: PrContext = {
  owner: 'acme',
  repo: 'shop',
  sha: 'cafe1234cafe1234cafe1234cafe1234cafe1234',
  prNumber: 42,
  prTitle: which === 'python' ? 'feat: speed up checkout' : 'feat(orders): introduce OrderService layer',
};

const report = loadReport(join(fixtureDir, file));
process.stdout.write(renderOverview(report, { ctx, audioUrl: 'https://github.com/acme/shop/actions/runs/1/artifacts/2' }));
