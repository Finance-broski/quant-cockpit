import { Routes, Route, Navigate } from "react-router-dom";
import Bridge from "./pages/Bridge";

// Cockpit-only app (portfolio demo). The full multi-page app lives in a private repo.
export default function App() {
  return (
    <Routes>
      <Route path="/bridge" element={<Bridge />} />
      <Route path="*" element={<Navigate to="/bridge" replace />} />
    </Routes>
  );
}
