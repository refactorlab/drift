import { useEffect, useState } from "react";

import type { StepState } from "../store/runStore";
import { CheckIcon, STEP_ICONS, XIcon } from "./icons";

interface Props {
  steps: StepState[];
}

export default function Steps({ steps }: Props) {
  /* Cascade-in: each row fades in 80ms after the previous one (matches the
   * original example.html). We track which indices have become visible so the
   * animation runs once even if the steps array updates rapidly. */
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= steps.length) return;
    const t = setTimeout(() => setVisibleCount((n) => n + 1), 80);
    return () => clearTimeout(t);
  }, [visibleCount, steps.length]);

  return (
    <div className="steps">
      {steps.map((s, i) => {
        const visible = i < visibleCount;
        const stateClass = s.status === "pending" ? "" : s.status;
        return (
          <div key={i} className={`step ${visible ? "visible" : ""} ${stateClass}`}>
            <div className="step-icon">
              {s.status === "done" ? <CheckIcon /> : s.status === "error" ? <XIcon /> : STEP_ICONS[i]}
            </div>
            <div className="step-text">
              {s.title}
              <div className="step-detail">{s.detail}</div>
            </div>
            <div className="step-time">
              {s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)}s` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
