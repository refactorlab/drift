import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import DoneState from "../components/DoneState";
import MagicOrb from "../components/MagicOrb";
import Orbs from "../components/Orbs";
import ReasoningLog, { useAgentEvents } from "../components/ReasoningLog";
import RunButton from "../components/RunButton";
import ScanGoalPicker, { resolveGoalPrompt } from "../components/ScanGoalPicker";
import SearchBox from "../components/SearchBox";
import Steps from "../components/Steps";
import UpdateBanner from "../components/UpdateBanner";
import { SettingsIcon } from "../components/icons";
import {
  listPromptPresets,
  onRunComplete,
  onRunError,
  onStepUpdate,
  type PromptPreset,
  selectProjectPath,
  startAgentRun,
} from "../lib/tauri";
import { useRunStore } from "../store/runStore";

export default function HomePage() {
  const navigate = useNavigate();
  const {
    projectPath,
    setProjectPath,
    runId,
    isRunning,
    error,
    result,
    steps,
    beginRun,
    applyStep,
    finishRun,
    failRun,
    reset,
    setLogEntries,
  } = useRunStore();

  // Goal picker state. Local because it doesn't survive a run — once a scan
  // begins, the prompt is locked in. Reset() in DoneState clears the run but
  // the user might want to keep their picked goal for a re-run, so we leave it.
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");

  // Agent-event subscription. Mounted unconditionally on this page so the
  // `agent:event` listener attaches before any `start_agent_run` POST returns
  // — closing the early-event race per goose's UI↔Rust framework §7.
  const { entries: agentEntries, reset: resetAgentEntries } = useAgentEvents();

  // Mirror the live agent log into the run store so the Report page can
  // render it after Home unmounts. The store treats this slot as the source
  // of truth for both the live and the post-run views.
  useEffect(() => {
    setLogEntries(agentEntries);
  }, [agentEntries, setLogEntries]);

  // Load presets once on mount. Failure is non-blocking — `ScanGoalPicker`
  // shows its own error and the user can still kick off a default-recipe run.
  useEffect(() => {
    let cancelled = false;
    listPromptPresets()
      .then((p) => {
        if (!cancelled) setPresets(p);
      })
      .catch(() => {
        /* logged inside the picker */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to backend events for the lifetime of the page.
  useEffect(() => {
    let stepUnsub: (() => void) | undefined;
    let doneUnsub: (() => void) | undefined;
    let errUnsub: (() => void) | undefined;

    (async () => {
      stepUnsub = await onStepUpdate((u) => {
        applyStep({ index: u.index, status: u.status, detail: u.detail, durationMs: u.durationMs });
      });
      doneUnsub = await onRunComplete((c) => finishRun(c));
      errUnsub = await onRunError((e) => failRun(e.message));
    })();

    return () => {
      stepUnsub?.();
      doneUnsub?.();
      errUnsub?.();
    };
  }, [applyStep, finishRun, failRun]);

  const handleStart = async () => {
    if (isRunning) return;
    try {
      // Reset the agent log *before* the POST so any events that arrive
      // before React rerenders don't get stale entries from the previous run.
      resetAgentEntries();
      // Resolve the picker selection into a prompt string (or undefined for
      // the default recipe). The picker's `resolveGoalPrompt` understands the
      // OTHER sentinel — keeping that here would couple Home to internals.
      const goalPrompt = resolveGoalPrompt(presets, selectedGoal, customPrompt);
      const id = await startAgentRun(projectPath, { mode: "auto", goalPrompt });
      beginRun(id, { projectPath, mode: "auto", goalPrompt });
    } catch (e) {
      failRun(e instanceof Error ? e.message : String(e));
    }
  };

  // Rerun the same scan with the params that produced the most-recent run.
  // The Rust side tears down any in-flight previous scan before the new one
  // starts (see `start_agent_run`), so this always begins from scratch.
  const handleRerun = async () => {
    const params = useRunStore.getState().runParams;
    if (!params) return;
    try {
      resetAgentEntries();
      const id = await startAgentRun(params.projectPath, {
        mode: params.mode,
        goalPrompt: params.goalPrompt,
      });
      beginRun(id, params);
    } catch (e) {
      failRun(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePick = async () => {
    const picked = await selectProjectPath();
    if (picked) setProjectPath(picked);
  };

  const view = !runId ? "idle" : result ? "done" : "running";

  return (
    <div className="stage">
      <Orbs />

      <div className="home-update-slot">
        <UpdateBanner compact />
      </div>

      <button
        type="button"
        className="settings-fab"
        aria-label="Settings"
        onClick={() => navigate("/settings")}
      >
        <SettingsIcon />
      </button>

      {view === "idle" && (
        <>
          <div className="logo">Drift</div>
          <div className="logo-sub">by refactor-labs</div>

          <SearchBox
            value={projectPath}
            onChange={setProjectPath}
            onPick={handlePick}
            onSubmit={handleStart}
            disabled={isRunning}
          />

          <ScanGoalPicker
            selected={selectedGoal}
            customPrompt={customPrompt}
            onSelect={setSelectedGoal}
            onCustomPromptChange={setCustomPrompt}
            disabled={isRunning}
          />

          <RunButton onClick={handleStart} disabled={isRunning || !projectPath.trim()} />

          <div className="hint">
            Press <kbd>Enter</kbd> to start
          </div>

          {error && (
            <div className="hint" style={{ color: "#c82626", marginTop: 12 }}>
              {error}
            </div>
          )}
        </>
      )}

      {view === "running" && (
        <div className="loading-wrap">
          <MagicOrb />
          <Steps steps={steps} />
          <ReasoningLog entries={agentEntries} />
        </div>
      )}

      {view === "done" && result && (
        <DoneState
          issuesFound={result.issuesFound}
          criticalCount={result.criticalCount}
          onView={() => navigate(`/report/${result.runId}`)}
          onRerun={handleRerun}
          onReset={reset}
        />
      )}
    </div>
  );
}
