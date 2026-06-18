// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ChangeImpactGraph } from './ChangeImpactGraph';
import type { FileGraph } from '../../core/changeImpactGraph';

// A → S → B → C : caller, the changed seed, two callees → scope levels 0,1,2.
const graph: FileGraph = {
  direction: 'LR',
  nodes: [
    { id: 'A', label: 'caller' },
    { id: 'S', label: 'seedSym', cls: 'changed' },
    { id: 'B', label: 'callee' },
    { id: 'C', label: 'deepCallee' },
  ],
  edges: [{ from: 'A', to: 'S' }, { from: 'S', to: 'B' }, { from: 'B', to: 'C' }],
  classDefs: [{ name: 'changed', fill: '#9e6a03', stroke: '#d29922', color: '#fff' }],
  seeds: ['S'],
};

// Fake timers so the auto-sweep setTimeout never fires mid-assertion (and rAF is a no-op).
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ChangeImpactGraph', () => {
  it('renders every node label and one build segment per node', () => {
    const { container } = render(<ChangeImpactGraph graph={graph} soundEnabled={false} />);
    for (const label of ['caller', 'seedSym', 'callee', 'deepCallee']) {
      expect(container.textContent).toContain(label);
    }
    // 4 nodes → 4 build segments (one reveal step each).
    expect(container.querySelectorAll('.cig-scope-seg')).toHaveLength(4);
  });

  it('reveals nodes + edges one-by-one (none shown until the build advances)', () => {
    const { container } = render(<ChangeImpactGraph graph={graph} soundEnabled={false} />);
    // Build hasn't advanced (fake timers) → nothing is revealed yet.
    expect(container.querySelectorAll('.cig-node.shown')).toHaveLength(0);
    expect(container.querySelectorAll('.cig-edge.shown')).toHaveLength(0);
    // Scrub to the end → the whole graph is revealed (4 nodes, 3 edges drawn).
    const segs = container.querySelectorAll('.cig-scope-seg');
    fireEvent.click(segs[segs.length - 1]);
    expect(container.querySelectorAll('.cig-node.shown')).toHaveLength(4);
    expect(container.querySelectorAll('.cig-edge.shown')).toHaveLength(3);
  });

  it('reveals just the build frontier when scrubbed partway', () => {
    const { container } = render(<ChangeImpactGraph graph={graph} soundEnabled={false} />);
    const segs = container.querySelectorAll('.cig-scope-seg');
    fireEvent.click(segs[1]); // reveal the first 2 nodes only
    expect(container.querySelectorAll('.cig-node.shown')).toHaveLength(2);
    // Only an edge whose BOTH endpoints are revealed is drawn.
    expect(container.querySelectorAll('.cig-edge.shown').length).toBeLessThan(3);
  });

  it('opens in dark mode and flips to light via the theme toggle', () => {
    const { container, getByLabelText } = render(<ChangeImpactGraph graph={graph} soundEnabled={false} />);
    expect(container.querySelector('.cig')?.getAttribute('data-graph-theme')).toBe('dark');
    fireEvent.click(getByLabelText('Toggle theme'));
    expect(container.querySelector('.cig')?.getAttribute('data-graph-theme')).toBe('light');
  });

  it('reflects the effective sound default (voice/setting) on the ♪ control', () => {
    const { getByLabelText } = render(<ChangeImpactGraph graph={graph} soundEnabled />);
    expect(getByLabelText('Toggle sound').className).toContain('on');
  });

  it('selects a node on click (highlighting its subtree)', () => {
    const { container } = render(<ChangeImpactGraph graph={graph} soundEnabled={false} />);
    const seed = [...container.querySelectorAll('.cig-node')].find((n) => n.textContent?.includes('seedSym'));
    expect(seed).toBeTruthy();
    fireEvent.click(seed!);
    expect(seed!.getAttribute('class')).toContain('select');
  });
});
