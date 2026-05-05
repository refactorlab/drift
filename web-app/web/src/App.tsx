import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/Dashboard';
import ScansListPage from './pages/ScansList';
import ScanReportPage from './pages/ScanReport';
import ImprovementsPage from './pages/Improvements';
import RepositoriesPage from './pages/Repositories';
import LoginPage from './pages/Login';
import { AuthProvider, useAuth } from './auth';

function AuthGate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <div className="auth-loading">Loading…</div>;
  }

  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/scans" element={<ScansListPage />} />
      <Route path="/scans/:prNumber" element={<ScanReportPage />} />
      <Route path="/improvements" element={<ImprovementsPage />} />
      <Route path="/repositories" element={<RepositoriesPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthGate />
      </BrowserRouter>
    </AuthProvider>
  );
}
