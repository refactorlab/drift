import type { PR, Scan } from '../types';
import { BranchIcon, ClockIcon, FilesIcon } from './icons';

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (m === 0) return `${s}s ago`;
  return `${m}m ${s.toString().padStart(2, '0')}s ago`;
}

export function PRHeader({ pr, scan }: { pr: PR; scan: Scan }) {
  const verdictPassed = scan.verdict === 'PASSED';
  return (
    <>
      <div className="breadcrumb">
        <a href="#">{pr.repo.owner}</a>
        <span className="sep">/</span>
        <a href="#">{pr.repo.name}</a>
        <span className="sep">/</span>
        <a href="#">Pull Requests</a>
        <span className="sep">/</span>
        <strong>#{pr.number}</strong>
      </div>
      <div className="pr-header">
        <div className="pr-title-block">
          <div className="pr-title">
            {pr.title}
            <span className="pr-number">#{pr.number}</span>
          </div>
          <div className="pr-meta">
            <div className="pr-meta-item">
              <BranchIcon />
              {pr.branch} → {pr.baseBranch}
            </div>
            <div className="pr-meta-item">
              <ClockIcon />
              Profiled {timeAgo(scan.profiledAt)}
            </div>
            <div className="pr-meta-item">
              <FilesIcon />
              {pr.commits} commits · {pr.filesChanged} files
            </div>
          </div>
        </div>
        <div className={`verdict-card${verdictPassed ? ' passed' : ''}`}>
          <div className="verdict-label">Profile Verdict</div>
          <div className="verdict-value">{scan.verdict}</div>
          <div className="verdict-sub">{scan.verdictSub}</div>
        </div>
      </div>
    </>
  );
}
