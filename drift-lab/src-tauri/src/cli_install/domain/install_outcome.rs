//! What happened when we tried to install the CLI. Tagged enum so the
//! UI and the Settings page can branch on the variant without parsing
//! free-form strings.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum InstallOutcome {
    /// Fresh install (or repair after detecting a stale link) succeeded.
    Installed { target: PathBuf },

    /// Already installed AND pointing at the current bundle. The
    /// self-heal pass on every launch sets this when nothing needs
    /// doing — distinct from `Installed` so logs read truthfully.
    AlreadyInstalled { target: PathBuf },

    /// Install completed at the filesystem level, but the destination
    /// directory isn't on the user's PATH. Surface to the UI so the
    /// user can opt in to the shell-rc edit themselves.
    NeedsManualAction {
        target: PathBuf,
        reason: String,
        /// Ready-to-paste instructions. The UI exposes a Copy button.
        instructions: String,
    },

    /// Install was skipped on purpose — debug build, opt-out sentinel,
    /// missing bundle resource on a dev run, etc. The `reason` string
    /// is for the log and the Settings UI's "Why isn't this on?" hint.
    Skipped { reason: String },
}

impl InstallOutcome {
    /// True for the two variants that put `drift` on disk where the
    /// user can reach it. Used by the self-heal verify pass.
    pub fn is_installed(&self) -> bool {
        matches!(
            self,
            InstallOutcome::Installed { .. } | InstallOutcome::AlreadyInstalled { .. }
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_installed_only_true_for_installed_variants() {
        let target = PathBuf::from("/x/drift");
        assert!(InstallOutcome::Installed { target: target.clone() }.is_installed());
        assert!(InstallOutcome::AlreadyInstalled { target: target.clone() }.is_installed());
        assert!(!InstallOutcome::NeedsManualAction {
            target,
            reason: "x".into(),
            instructions: "y".into(),
        }
        .is_installed());
        assert!(!InstallOutcome::Skipped { reason: "debug build".into() }.is_installed());
    }

    #[test]
    fn variants_roundtrip_through_json_with_tag() {
        let cases = vec![
            InstallOutcome::Installed { target: PathBuf::from("/x") },
            InstallOutcome::AlreadyInstalled { target: PathBuf::from("/y") },
            InstallOutcome::NeedsManualAction {
                target: PathBuf::from("/z"),
                reason: "PATH".into(),
                instructions: "add to ~/.zshrc".into(),
            },
            InstallOutcome::Skipped { reason: "debug".into() },
        ];
        for c in cases {
            let s = serde_json::to_string(&c).unwrap();
            // Wire contract: snake_case tag.
            assert!(
                s.contains("\"kind\":\"installed\"")
                    || s.contains("\"kind\":\"already_installed\"")
                    || s.contains("\"kind\":\"needs_manual_action\"")
                    || s.contains("\"kind\":\"skipped\""),
                "missing tag in {s}"
            );
            let back: InstallOutcome = serde_json::from_str(&s).unwrap();
            assert_eq!(c, back);
        }
    }
}
