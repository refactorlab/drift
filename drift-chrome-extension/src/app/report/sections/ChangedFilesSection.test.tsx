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
  it('summarises scope in one line with per-status badges — not a full table', () => {
    const { container } = render(<ChangedFilesSection files={FILES} />);
    expect(screen.getByText('Changed files')).toBeTruthy();
    const text = container.textContent ?? '';
    // status count badges present (added / modified / removed / renamed)
    for (const label of ['1 added', '1 modified', '1 removed', '1 renamed']) {
      expect(text).toContain(label);
    }
    // one-line summary: file count + total LOC (13 added, 8 deleted)
    expect(text).toContain('4 files changed');
    expect(text).toContain('+13');
    expect(text).toContain('−8');
    // the per-file paths are NOT enumerated — that's the PR's own diff view
    expect(text).not.toContain('src/old.ts');
    expect(container.querySelector('table')).toBeNull();
  });

  it('renders nothing when there is no diff data', () => {
    const { container } = render(<ChangedFilesSection files={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
