//! Pure URL builder — no I/O, no `url` crate dependency, fully testable.
//!
//! Mirrors the Python publisher's `_build_wss_url` (`supabase.py:90-104`)
//! line for line so the publisher's and subscriber's URL canonicalisation
//! never diverge.

use super::{defaults::VSN, errors::RealtimeError};

/// Build the Realtime WSS URL from a project URL + JWT.
///
/// Tolerates the four input shapes the Python builder tolerates:
/// `https://<host>`, `http://<host>`, `wss://<host>`, `ws://<host>`,
/// and a bare `<host>` with no scheme. Strips anything after the
/// authority (path / query / fragment) — Supabase URLs never carry one,
/// but users occasionally paste with trailing slashes.
///
/// Scheme is preserved: an `http://` or `ws://` input → `ws://` output
/// (plaintext, for talking to a self-hosted drift observability-server
/// on loopback), anything else → `wss://`.
pub fn build_wss_url(supabase_url: &str, api_key: &str) -> Result<String, RealtimeError> {
    let trimmed = supabase_url.trim();
    if trimmed.is_empty() {
        return Err(RealtimeError::InvalidUrl(supabase_url.to_string()));
    }
    if api_key.is_empty() {
        return Err(RealtimeError::MissingApiKey);
    }
    // Plaintext when the input asked for it; TLS otherwise. The four
    // accepted shapes map two-into-one: `http://` and `ws://` → `ws`,
    // `https://`, `wss://`, and bare-host → `wss`.
    let plaintext =
        trimmed.starts_with("http://") || trimmed.starts_with("ws://");
    let host = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .or_else(|| trimmed.strip_prefix("wss://"))
        .or_else(|| trimmed.strip_prefix("ws://"))
        .unwrap_or(trimmed);
    let host = host.split(['/', '?', '#']).next().unwrap_or(host);
    if host.is_empty() {
        return Err(RealtimeError::InvalidUrl(supabase_url.to_string()));
    }
    let scheme = if plaintext { "ws" } else { "wss" };
    Ok(format!(
        "{scheme}://{host}/realtime/v1/websocket?apikey={api_key}&vsn={VSN}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn https_url_canonicalises_to_wss() {
        let got = build_wss_url("https://abc123.supabase.co", "jwt").unwrap();
        assert_eq!(
            got,
            "wss://abc123.supabase.co/realtime/v1/websocket?apikey=jwt&vsn=1.0.0"
        );
    }

    #[test]
    fn bare_host_is_accepted() {
        let got = build_wss_url("abc123.supabase.co", "jwt").unwrap();
        assert!(got.starts_with("wss://abc123.supabase.co/"));
    }

    #[test]
    fn trailing_slash_and_path_are_stripped() {
        let got = build_wss_url("https://abc123.supabase.co/foo?x=y", "jwt").unwrap();
        assert!(got.starts_with("wss://abc123.supabase.co/realtime/v1/"));
    }

    #[test]
    fn whitespace_is_trimmed() {
        let got = build_wss_url("  https://abc.supabase.co  ", "jwt").unwrap();
        assert!(got.starts_with("wss://abc.supabase.co/"));
    }

    #[test]
    fn empty_url_is_rejected() {
        match build_wss_url("", "jwt").unwrap_err() {
            RealtimeError::InvalidUrl(_) => {}
            e => panic!("expected InvalidUrl, got {e:?}"),
        }
    }

    #[test]
    fn http_input_yields_plaintext_ws() {
        let got = build_wss_url("http://localhost:8080", "jwt").unwrap();
        assert_eq!(
            got,
            "ws://localhost:8080/realtime/v1/websocket?apikey=jwt&vsn=1.0.0"
        );
    }

    #[test]
    fn ws_input_yields_plaintext_ws() {
        let got = build_wss_url("ws://localhost:8080", "jwt").unwrap();
        assert!(got.starts_with("ws://localhost:8080/"));
    }

    #[test]
    fn empty_key_is_rejected_as_missing() {
        match build_wss_url("https://abc.supabase.co", "").unwrap_err() {
            RealtimeError::MissingApiKey => {}
            e => panic!("expected MissingApiKey, got {e:?}"),
        }
    }
}
