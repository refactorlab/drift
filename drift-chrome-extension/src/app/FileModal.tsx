import { useEffect } from 'react';
import type { ArtifactRef } from '../core/types';
import { ArtifactFile } from './ArtifactFile';

// Modal overlay for viewing a single file. Opens on chip click; the card
// downloads + shows the real content. Closes on ✕, backdrop click, or Escape.
export function FileModal({
  artifact,
  onClose,
}: {
  artifact: ArtifactRef;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <span className="modal-title">File</span>
          <button className="iconbtn" title="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal-body">
          {/* The card downloads + renders the real file; defaultOpen starts it */}
          <ArtifactFile artifact={artifact} defaultOpen />
        </div>
      </div>
    </div>
  );
}
