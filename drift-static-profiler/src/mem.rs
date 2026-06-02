//! Process memory introspection — the one signal that turns a silent
//! OOM-kill into a diagnosable event.
//!
//! When the kernel OOM-killer (or a CI runner's cgroup limit) reaps the
//! process it does so with SIGKILL: no unwinding, no `Drop`, no final
//! log line. The parent (a GitHub runner) only sees the child vanish
//! with signal 137 and reports `Error: The operation was canceled.` —
//! with zero clue that memory was the cause. The remedy is to sample
//! our *own* RSS as we go and (a) log it at every pipeline boundary so
//! the growth curve is visible under `DRIFT_LOG`, and (b) stop
//! voluntarily before crossing a soft ceiling, emitting a WARN that
//! names the cause instead of letting the kernel reap us mid-allocation.
//!
//! Built on POSIX `getrusage(RUSAGE_SELF)`, whose `ru_maxrss` is the
//! high-water-mark resident set size. The only platform wart is the
//! unit: Linux reports kibibytes, the BSDs/macOS report bytes. We
//! normalize to bytes.

/// Peak resident set size of the current process in bytes, or `None`
/// when the syscall is unavailable. Monotonic non-decreasing over the
/// process lifetime, so it doubles as a "have we ever crossed X?" guard
/// without needing a separate current-RSS probe.
// Without `libc` (wasm builds) there is no getrusage; RSS sampling degrades to
// `None`, which every caller already handles (logs `rss_mb = ?`).
#[cfg(not(feature = "native"))]
pub fn peak_rss_bytes() -> Option<u64> {
    None
}

#[cfg(feature = "native")]
pub fn peak_rss_bytes() -> Option<u64> {
    // SAFETY: `getrusage` only writes into the `rusage` we pass it; a
    // zeroed struct is a valid initial state and we read one field back.
    let mut usage: libc::rusage = unsafe { std::mem::zeroed() };
    let rc = unsafe { libc::getrusage(libc::RUSAGE_SELF, &mut usage) };
    if rc != 0 {
        return None;
    }
    let maxrss = usage.ru_maxrss;
    if maxrss <= 0 {
        return None;
    }
    #[cfg(target_os = "linux")]
    {
        // Linux: ru_maxrss is kibibytes.
        Some((maxrss as u64).saturating_mul(1024))
    }
    #[cfg(not(target_os = "linux"))]
    {
        // macOS / BSD: ru_maxrss is already bytes.
        Some(maxrss as u64)
    }
}

/// Peak RSS rounded to whole mebibytes, for compact log fields. `None`
/// when the syscall is unavailable (so callers can log `rss_mb = ?`).
pub fn peak_rss_mb() -> Option<u64> {
    peak_rss_bytes().map(|b| b / (1024 * 1024))
}
