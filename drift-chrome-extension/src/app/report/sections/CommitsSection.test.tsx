// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CommitsSection } from './CommitsSection';

afterEach(cleanup);

describe('CommitsSection', () => {
  it('lists commit subjects (newest first) with conventional-commit type badges', () => {
    const { container } = render(
      <CommitsSection
        commits={[
          'feat: add enrichment loop\n\nbody text here',
          'fix: handle empty rows',
          'chore: bump deps',
        ]}
      />,
    );
    expect(screen.getByText('Commits')).toBeTruthy();
    const text = container.textContent ?? '';
    // subjects shown, bodies not
    expect(text).toContain('feat: add enrichment loop');
    expect(text).toContain('fix: handle empty rows');
    expect(text).not.toContain('body text here');
    // type badges
    for (const t of ['feat', 'fix', 'chore']) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    // newest first: fix/chore appear before feat in DOM order
    expect(text.indexOf('bump deps')).toBeLessThan(text.indexOf('enrichment loop'));
  });

  it('renders nothing without commits', () => {
    const { container } = render(<CommitsSection commits={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
