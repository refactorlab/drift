import { useNavigate, useParams } from "react-router-dom";

import Orbs from "../components/Orbs";

export default function ReportPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  return (
    <div className="report-page">
      <Orbs />
      <div className="report-card">
        <h1>Run report</h1>
        <div className="muted">Run ID · {runId}</div>
        <p>
          This page is a placeholder. The flame graph, ranked bottlenecks, and
          remediation suggestions will render here once the backend wires the
          analyzer output through to the UI.
        </p>
        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <button type="button" className="ghost-btn" onClick={() => navigate("/")}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
