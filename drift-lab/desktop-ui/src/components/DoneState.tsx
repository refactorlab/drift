import { ArrowRightIcon, CheckIcon } from "./icons";

interface Props {
  issuesFound: number;
  criticalCount: number;
  onView: () => void;
  onRerun: () => void;
  onReset: () => void;
}

export default function DoneState({
  issuesFound,
  criticalCount,
  onView,
  onRerun,
  onReset,
}: Props) {
  return (
    <div className="done-state">
      <div className="done-icon">
        <CheckIcon />
      </div>
      <div>
        <div className="done-title">Found it ✨</div>
        <div className="done-sub">
          {issuesFound} performance {issuesFound === 1 ? "issue" : "issues"} detected · {criticalCount} critical
        </div>
      </div>
      <div className="done-actions">
        <button type="button" className="view-btn" onClick={onView}>
          View report
          <ArrowRightIcon />
        </button>
        <button type="button" className="ghost-btn" onClick={onRerun}>
          ↻ Rerun
        </button>
        <button type="button" className="ghost-btn" onClick={onReset}>
          Run another
        </button>
      </div>
    </div>
  );
}
