// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StatTile } from './primitives';

afterEach(cleanup);

describe('StatTile', () => {
  it('shows value + label and a meter only for fractional metrics', () => {
    const { container } = render(<StatTile label="Merge confidence" value="2/5" tone="bad" fraction={0.4} />);
    expect(container.textContent).toContain('2/5');
    expect(container.textContent).toContain('Merge confidence');
    const fill = container.querySelector('.rp-stat-meter-fill') as HTMLElement | null;
    expect(fill).toBeTruthy();
    expect(fill!.style.width).toBe('40%');
  });

  it('omits the meter for plain counts (no empty rings)', () => {
    const { container } = render(<StatTile label="Risks" value="11" tone="good" />);
    expect(container.textContent).toContain('11');
    expect(container.querySelector('.rp-stat-meter')).toBeNull();
  });
});
