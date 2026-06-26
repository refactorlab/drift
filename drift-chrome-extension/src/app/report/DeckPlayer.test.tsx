import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DeckPlayer } from './DeckPlayer';
import type { ExplainerDoc } from '../../agents/explainerDoc';

afterEach(cleanup);

const doc: ExplainerDoc = {
  prTitle: 'My PR',
  verdict: 'address',
  verdictLabel: 'Address before merge',
  fileCount: 3,
  totalSec: 20,
  slides: [
    {
      kind: 'overview',
      eyebrow: 'OVERVIEW · 3 FILES',
      title: 'My PR',
      durationSec: 10,
      narration: [{ who: 'A', text: 'one two three' }],
      questions: [{ severity: 'critical', text: 'Is auth covered?', file: 'src/auth.ts', cites: ['src/auth.ts'], fix: 'add a test' }],
    },
    {
      kind: 'critique',
      eyebrow: 'CRITIQUE',
      title: 'What lands',
      durationSec: 10,
      narration: [{ who: 'B', text: 'looks ok' }],
      critique: [{ kind: 'good', title: 'Tests included', detail: '2 tests' }],
    },
  ],
};

describe('<DeckPlayer>', () => {
  it('renders the first slide, verdict and counter', () => {
    render(<DeckPlayer doc={doc} />);
    expect(screen.getByText('My PR')).toBeTruthy();
    expect(screen.getByText('Address before merge')).toBeTruthy();
    expect(screen.getByText('Is auth covered?')).toBeTruthy();
  });

  it('expands a question on click (progressive disclosure) to show the fix + citation', () => {
    render(<DeckPlayer doc={doc} />);
    expect(screen.queryByText(/Ask drift to answer/)).toBeNull();
    fireEvent.click(screen.getByText('Is auth covered?'));
    expect(screen.getByText(/Ask drift to answer/)).toBeTruthy();
    expect(screen.getByText(/add a test/)).toBeTruthy();
    expect(screen.getByText('grounded in')).toBeTruthy(); // citation row revealed
    expect(screen.getAllByText('auth.ts').length).toBeGreaterThanOrEqual(2); // file pill + cite chip
  });

  it('jumps to a slide from the filmstrip', () => {
    render(<DeckPlayer doc={doc} />);
    expect(screen.queryByText(/Tests included/)).toBeNull(); // critique slide not shown yet
    fireEvent.click(screen.getByText(/What lands/)); // critique filmstrip frame
    expect(screen.getByText(/Tests included/)).toBeTruthy();
  });

  it('renders one filmstrip frame per slide', () => {
    render(<DeckPlayer doc={doc} />);
    expect(screen.getAllByText(/overview|critique/i).length).toBeGreaterThanOrEqual(2);
  });
});
