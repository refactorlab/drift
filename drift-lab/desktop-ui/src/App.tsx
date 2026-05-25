import { useEffect, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";

import Onboarding from "./components/Onboarding";
import { AppConfig, getAppConfig, onOpenSettings } from "./lib/tauri";
import { useStaticScanSubscription } from "./lib/useStaticScanSubscription";
import DashboardPage from "./pages/Dashboard";
import HomePage from "./pages/Home";
import LiveScanPage from "./pages/LiveScan";
import ReportPage from "./pages/Report";
import ScanReportPage from "./pages/ScanReport";
import SettingsPage from "./pages/Settings";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    getAppConfig().then(setConfig);
  }, []);

  if (config === null) {
    return null; // brief bootstrap
  }

  if (!config.onboardingComplete) {
    return <Onboarding onComplete={() => getAppConfig().then(setConfig)} />;
  }

  return <RoutedApp />;
}

/**
 * Routed view — split from `App` so the static-scan subscription hook only
 * runs *after* onboarding completes. Mounting it above the onboarding gate
 * would install listeners against a not-yet-configured backend and (worse)
 * never re-run when the user finishes onboarding.
 */
function RoutedApp() {
  // Listeners live at the app level so a running scan survives navigation
  // to Settings — see useStaticScanSubscription for the full rationale.
  useStaticScanSubscription();
  useOpenSettingsFromTray();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/scan/:scanId" element={<ScanReportPage />} />
      <Route path="/dashboard/:scanId" element={<DashboardPage />} />
      <Route path="/report/:runId" element={<ReportPage />} />
      <Route path="/live-scan" element={<LiveScanPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}

/**
 * Subscribe to the tray's "Settings…" menu item. The Rust side
 * (`tray.rs`) shows the main window and emits `tray://open-settings`; we
 * navigate to `/settings` so the user lands exactly where they expected.
 * Lives inside `RoutedApp` because `useNavigate` requires a router
 * context — mounting it above the onboarding gate would crash.
 */
function useOpenSettingsFromTray(): void {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    onOpenSettings(() => navigate("/settings")).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);
}
