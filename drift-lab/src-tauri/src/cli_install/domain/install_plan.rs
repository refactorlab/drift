//! The full plan an adapter produces from `plan()` and consumes via
//! `execute()`. Surfaces:
//!
//! * the source binary's location in the bundle,
//! * the destination + strategy,
//! * an optional shell-rc hint when the destination dir isn't on PATH.
//!
//! Shell-rc edits are NEVER applied silently. The hint is data only;
//! the UI presents it as copy-paste instructions and the user opts in.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::install_target::InstallTarget;

/// Instructions the user can apply themselves to put the install
/// destination on PATH. We don't mutate shell rc files because that is
/// the kind of behaviour users notice years later when something
/// breaks and they can't tell who edited their dotfiles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellRcHint {
    /// e.g. `/Users/ilyas/.zshrc`.
    pub rc_path: PathBuf,
    /// The exact single line to append, ready to paste.
    pub line_to_append: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPlan {
    /// Absolute path to the `drift` binary inside the bundle.
    pub source: PathBuf,
    /// Where the install should land + how.
    pub target: InstallTarget,
    /// Set when the user needs to add the destination dir to their
    /// PATH. `None` when PATH already contains the dest or when the
    /// strategy is [`super::install_target::InstallStrategy::PathEntry`]
    /// (Windows — installer takes care of PATH).
    pub shell_rc_hint: Option<ShellRcHint>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::install_target::{InstallScope, InstallStrategy};

    #[test]
    fn plan_roundtrips_through_json() {
        let plan = InstallPlan {
            source: PathBuf::from("/Applications/Drift Lab.app/Contents/Resources/drift"),
            target: InstallTarget {
                dest: PathBuf::from("/Users/ilyas/.local/bin/drift"),
                scope: InstallScope::User,
                strategy: InstallStrategy::Symlink,
            },
            shell_rc_hint: Some(ShellRcHint {
                rc_path: PathBuf::from("/Users/ilyas/.zshrc"),
                line_to_append: "export PATH=\"$HOME/.local/bin:$PATH\"".into(),
            }),
        };
        let s = serde_json::to_string(&plan).unwrap();
        let back: InstallPlan = serde_json::from_str(&s).unwrap();
        assert_eq!(plan, back);
    }
}
