import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Collapsible, ForceExpandContext } from './primitives';

afterEach(cleanup);

// The HTML export snapshots an off-screen report wrapped in
// ForceExpandContext.Provider value={true}. These tests lock in the contract that
// makes that export COMPLETE: a collapsed-by-default Collapsible must mount its
// body (so the content — and any mermaid inside — is in the DOM to be captured).
describe('Collapsible + ForceExpandContext', () => {
  it('keeps the body unmounted when collapsed and not forced', () => {
    render(
      <Collapsible title="Reliability gaps">
        <p>SECRET_BODY</p>
      </Collapsible>,
    );
    expect(screen.queryByText('SECRET_BODY')).toBeNull();
  });

  it('mounts the body when ForceExpandContext is true, even if defaultOpen is false', () => {
    render(
      <ForceExpandContext.Provider value={true}>
        <Collapsible title="Reliability gaps">
          <p>SECRET_BODY</p>
        </Collapsible>
      </ForceExpandContext.Provider>,
    );
    const body = screen.getByText('SECRET_BODY');
    expect(body).not.toBeNull();
    // The card also reflects the open state for styling/accessibility.
    expect(document.querySelector('.rp-collapse.open')).not.toBeNull();
    expect(document.querySelector('[aria-expanded="true"]')).not.toBeNull();
  });

  it('does not force the panel collapsibles when the provider is false (default)', () => {
    render(
      <ForceExpandContext.Provider value={false}>
        <Collapsible title="Reliability gaps">
          <p>SECRET_BODY</p>
        </Collapsible>
      </ForceExpandContext.Provider>,
    );
    expect(screen.queryByText('SECRET_BODY')).toBeNull();
  });
});
