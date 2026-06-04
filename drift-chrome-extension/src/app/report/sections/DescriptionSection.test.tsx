// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DescriptionSection } from './DescriptionSection';

afterEach(cleanup);

describe('DescriptionSection', () => {
  it('renders the PR body with the author line breaks preserved', () => {
    const { container } = render(<DescriptionSection body={'Fixes two bugs:\n\n1. trailing whitespace\n2. leading nodes'} />);
    expect(screen.getByText('Description')).toBeTruthy();
    const desc = container.querySelector('.rp-desc');
    expect(desc?.textContent).toContain('Fixes two bugs:');
    expect(desc?.textContent).toContain('2. leading nodes');
  });

  it('renders nothing for an empty or whitespace-only body', () => {
    expect(render(<DescriptionSection body={undefined} />).container.firstChild).toBeNull();
    cleanup();
    expect(render(<DescriptionSection body={'   \n  '} />).container.firstChild).toBeNull();
  });
});
