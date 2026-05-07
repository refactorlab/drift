import { Route, Routes } from "react-router-dom";

import HomePage from "./pages/Home";
import ReportPage from "./pages/Report";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/report/:runId" element={<ReportPage />} />
    </Routes>
  );
}
