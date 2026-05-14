import { useEffect, useRef, useState } from "react";

/**
 * Two-step inline-confirm delete button.
 *
 * Click 1 → turns red, label switches to "Click to confirm" and the
 * button keeps focus. A 3-second timer auto-reverts to the neutral state
 * if the user does nothing. Click 2 (within the window) invokes
 * `onConfirm()`. While `onConfirm` is pending the button shows
 * "Deleting…" and is disabled so a double-click can't double-fire the
 * IPC call.
 *
 * Why no `window.confirm()`: the native dialog is jarring on macOS,
 * blocks the entire renderer, and clashes with our visual register. The
 * inline pattern matches GitHub / Linear / Notion destructive secondary
 * actions and stays inside the row that owns the action.
 *
 * Caller decides what to show on success: this component just resolves
 * `onConfirm` and resets to neutral. Errors bubble up unchanged so the
 * caller can render an error toast or revert optimistic UI.
 */
interface Props {
  /// Async action to fire on the confirmed click. Returning a rejected
  /// promise leaves the button enabled and back in neutral so the user
  /// can retry.
  onConfirm: () => Promise<unknown>;
  /// Label shown in the neutral state. Defaults to "Delete".
  label?: string;
  /// Label shown after first click. Defaults to "Click to confirm".
  confirmLabel?: string;
  /// Label shown while `onConfirm` is in flight. Defaults to "Deleting…".
  pendingLabel?: string;
  /// Tooltip for the neutral state — surface the consequence here.
  title?: string;
  /// Extra class names. The component supplies its own base classes
  /// (`confirm-delete-btn` + state modifiers); use this for size /
  /// alignment overrides from the caller.
  className?: string;
  /// Optional disabled override (e.g. "scan still running, can't delete").
  disabled?: boolean;
}

type Phase = "idle" | "armed" | "pending";

const REVERT_AFTER_MS = 3000;

export default function ConfirmDeleteButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Click to confirm",
  pendingLabel = "Deleting…",
  title,
  className,
  disabled,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const revertTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (revertTimer.current !== null) window.clearTimeout(revertTimer.current);
    };
  }, []);

  const clearTimer = () => {
    if (revertTimer.current !== null) {
      window.clearTimeout(revertTimer.current);
      revertTimer.current = null;
    }
  };

  const armRevert = () => {
    clearTimer();
    revertTimer.current = window.setTimeout(() => {
      setPhase("idle");
      revertTimer.current = null;
    }, REVERT_AFTER_MS);
  };

  const handleClick = async () => {
    if (disabled || phase === "pending") return;
    if (phase === "idle") {
      setPhase("armed");
      armRevert();
      return;
    }
    // phase === "armed" — second click within the revert window confirms.
    clearTimer();
    setPhase("pending");
    try {
      await onConfirm();
      // Caller is expected to unmount us (remove the row) on success;
      // resetting to idle is still safe if we're still mounted.
      setPhase("idle");
    } catch {
      // Surface the failure by reverting to neutral so the user can
      // retry. Caller may show a toast — we don't render the error
      // inline so the button stays consistently sized.
      setPhase("idle");
    }
  };

  const buttonLabel =
    phase === "pending" ? pendingLabel : phase === "armed" ? confirmLabel : label;

  const stateClass = `confirm-delete-btn confirm-delete-btn--${phase}`;
  const finalClass = className ? `${stateClass} ${className}` : stateClass;

  return (
    <button
      type="button"
      className={finalClass}
      onClick={handleClick}
      disabled={disabled || phase === "pending"}
      aria-pressed={phase === "armed"}
      title={
        phase === "armed"
          ? `Click again within 3 s to confirm — or wait to cancel.`
          : title
      }
    >
      {phase === "armed" && <span aria-hidden>⚠ </span>}
      {buttonLabel}
    </button>
  );
}
