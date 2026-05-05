import { useState } from 'react';
import type { Issue } from '../types';
import { CodeBlock } from './CodeBlock';
import { BoltIcon } from './icons';

function inlineCode(text: string) {
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <code key={i} className="inline-code">{p}</code>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const startLine = issue.line_number ?? 1;
  const hasBody = !!(
    issue.problem || issue.code_before || issue.code_after || issue.suggestion_title
  );
  const [open, setOpen] = useState(hasBody);
  return (
    <div className="issue">
      <div className="issue-head" onClick={() => hasBody && setOpen((v) => !v)}>
        <div className={`severity-dot ${issue.severity}`} />
        <div className="issue-main">
          <div className="issue-title">
            {inlineCode(issue.title)}
            <span className={`badge ${issue.severity}`}>{issue.severity}</span>
          </div>
          <div className="issue-meta">
            <code>
              {issue.file_path}
              {issue.line_number ? `:${issue.line_number}` : ''}
            </code>
            {issue.meta && (
              <>
                <span>·</span>
                <span>{issue.meta}</span>
              </>
            )}
          </div>
        </div>
        <div className="issue-impact">
          <div className="impact-value">+{issue.impact_ms}ms</div>
          <div className="impact-label">P95 impact</div>
        </div>
      </div>
      {hasBody && open && (
        <div className="issue-body">
          {issue.problem && (
            <div className="issue-section">
              <div className="issue-section-label">Problem</div>
              <p>{inlineCode(issue.problem)}</p>
            </div>
          )}
          {issue.code_before && (
            <div className="issue-section">
              <div className="issue-section-label">Code</div>
              <CodeBlock
                title={issue.file_path}
                lang={issue.code_lang}
                startLine={startLine}
                code={issue.code_before}
                variant="bad"
              />
            </div>
          )}
          {issue.code_after && (
            <div className="issue-section">
              <div className="issue-section-label">
                {issue.code_before ? 'Suggested Fix' : 'Recommended Pattern'}
              </div>
              <CodeBlock
                title={issue.code_diff_label ?? 'Recommended pattern'}
                lang={issue.code_lang}
                startLine={startLine}
                code={issue.code_after}
                variant="good"
                rightLabel={issue.code_before ? '−4 +3' : '+8'}
              />
              {issue.suggestion_title && (
                <div className="suggestion-box">
                  <div className="suggestion-icon">
                    <BoltIcon />
                  </div>
                  <div className="suggestion-content">
                    <div className="suggestion-title">{issue.suggestion_title}</div>
                    {issue.suggestion_text && (
                      <div className="suggestion-text">{issue.suggestion_text}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {!issue.code_after && issue.suggestion_title && (
            <div className="issue-section">
              <div className="suggestion-box">
                <div className="suggestion-icon">
                  <BoltIcon />
                </div>
                <div className="suggestion-content">
                  <div className="suggestion-title">{issue.suggestion_title}</div>
                  {issue.suggestion_text && (
                    <div className="suggestion-text">{issue.suggestion_text}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <>
      <div className="section-title">
        <span>Detected Issues · {issues.length} total</span>
        <span className="section-title-sub">Sorted by impact</span>
      </div>
      {issues.map((i) => (
        <IssueRow key={i.id} issue={i} />
      ))}
    </>
  );
}
