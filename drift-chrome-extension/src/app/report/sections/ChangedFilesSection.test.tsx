// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ChangedFilesSection } from './ChangedFilesSection';
import type { ChangedFileStatus } from '../../../core/prDiff';

afterEach(cleanup);

const FILES: ChangedFileStatus[] = [
  { code: 'A', path: 'src/new.ts', additions: 10, deletions: 0 },
  { code: 'M', path: 'src/app.ts', additions: 3, deletions: 1 },
  { code: 'D', path: 'src/old.ts', additions: 0, deletions: 7 },
  { code: 'R', path: 'pkg/moved.ts', oldPath: 'src/moved.ts', additions: 0, deletions: 0 },
];

describe('ChangedFilesSection', () => {
  it('lists every changed file with its status — the literal diff', () => {
    const { container } = render(<ChangedFilesSection files={FILES} />);
    expect(screen.getByText('Changed files')).toBeTruthy();
    // status labels present (row badges)
    for (const label of ['added', 'modified', 'removed', 'renamed']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    const text = container.textContent ?? '';
    // every path shown, incl. the DELETED one (which the call-graph omits)
    expect(text).toContain('src/old.ts');
    // rename shows old → new (split across nodes, so assert on text content)
    expect(text).toContain('src/moved.ts');
    expect(text).toContain('pkg/moved.ts');
  });

  it('renders nothing when there is no diff data', () => {
    const { container } = render(<ChangedFilesSection files={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
