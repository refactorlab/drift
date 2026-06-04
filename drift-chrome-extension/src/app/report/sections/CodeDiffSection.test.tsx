// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CodeDiffSection } from './CodeDiffSection';
import type { ScanOutput } from '../../../core/scanOutput';

afterEach(cleanup);

const REPORT: ScanOutput = {
  pr_diff: {
    files: [
      {
        path: 'src/app.ts',
        status: 'M',
        additions: 2,
        deletions: 1,
        hunks: [
          {
            header: '@@ -1,2 +1,3 @@',
            lines: [
              { type: 'context', text: 'function f() {' },
              { type: 'del', text: '  return 1;' },
              { type: 'add', text: '  return 2;' },
              { type: 'add', text: '  // note' },
            ],
          },
        ],
      },
      // binary / no-hunk file is skipped
      { path: 'logo.png', status: 'M', additions: 0, deletions: 0, binary: true, hunks: [] },
    ],
  },
} as ScanOutput;

describe('CodeDiffSection', () => {
  it('shows the +/- hunks per file (skipping binary/no-hunk files)', () => {
    const { container } = render(<CodeDiffSection report={REPORT} />);
    expect(screen.getByText('Code diff')).toBeTruthy();
    // file with hunks is listed; binary file is not
    expect(screen.getByText('src/app.ts')).toBeTruthy();
    expect(screen.queryByText('logo.png')).toBeNull();
    // open the disclosure → see the +/- lines
    fireEvent.click(screen.getByText('src/app.ts'));
    const text = container.textContent ?? '';
    expect(text).toContain('+  return 2;');
    expect(text).toContain('-  return 1;');
    expect(text).toContain('@@ -1,2 +1,3 @@');
  });

  it('renders nothing without a pr_diff', () => {
    const { container } = render(<CodeDiffSection report={{} as ScanOutput} />);
    expect(container.firstChild).toBeNull();
  });
});
