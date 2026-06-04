// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PanZoom } from './PanZoom';
import { ForceExpandContext } from './primitives';

afterEach(cleanup);

describe('PanZoom (native-scroll graph viewport)', () => {
  it('renders a scrollable viewport with the child and zoom controls', () => {
    const { container } = render(
      <PanZoom>
        <div data-testid="diagram">graph</div>
      </PanZoom>,
    );
    expect(container.querySelector('.rp-graph-scroll')).toBeTruthy();
    expect(container.querySelector('.rp-graph-canvas')).toBeTruthy();
    expect(screen.getByTestId('diagram')).toBeTruthy();
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
    expect(screen.getByLabelText('Zoom out')).toBeTruthy();
    expect(screen.getByLabelText('Fit width')).toBeTruthy();
    // Defaults to fit-width (100%) — the floor, so the graph never under-fills.
    expect(screen.getByText('100%')).toBeTruthy();
    expect((container.querySelector('.rp-graph-canvas') as HTMLElement).style.width).toBe('100%');
  });

  it('zoom in widens the canvas; fit resets it to 100% width', () => {
    const { container } = render(
      <PanZoom>
        <div>graph</div>
      </PanZoom>,
    );
    const canvas = container.querySelector('.rp-graph-canvas') as HTMLElement;
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(canvas.style.width).toBe('130%');
    expect(screen.getByText('130%')).toBeTruthy();
    // Zoom-out never goes below the fit-width floor.
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(canvas.style.width).toBe('100%');
    // Fit snaps straight back to 100%.
    fireEvent.click(screen.getByLabelText('Zoom in'));
    fireEvent.click(screen.getByLabelText('Fit width'));
    expect(canvas.style.width).toBe('100%');
  });

  it('renders the child plainly under ForceExpandContext — no scroll box, no controls', () => {
    // The HTML export snapshots a force-expanded copy; the viewport must NOT clip
    // or scroll there, so the exported doc shows the whole diagram.
    const { container } = render(
      <ForceExpandContext.Provider value={true}>
        <PanZoom>
          <div data-testid="diagram">graph</div>
        </PanZoom>
      </ForceExpandContext.Provider>,
    );
    expect(screen.getByTestId('diagram')).toBeTruthy();
    expect(container.querySelector('.rp-graph-scroll')).toBeNull();
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
  });
});
