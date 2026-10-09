import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { PlannerPage } from './pages/PlannerPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { checkHealth } from './api';
import { Bell, X } from 'lucide-react';

export const App: React.FC = () => {
  const [engineOnline, setEngineOnline] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | undefined>();

  useEffect(() => {
    async function verifyHealth() {
      try {
        const health = await checkHealth();
        setEngineOnline(health.cpp_engine?.isOnline ?? false);
      } catch (e) {
        setEngineOnline(false);
      }
    }
    verifyHealth();
    const interval = setInterval(verifyHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
        {/* Top Navbar */}
        <Navbar engineOnline={engineOnline} />

        {/* Global Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 right-6 z-[9999] max-w-sm glass-panel border-blue-500/50 bg-blue-950/90 text-blue-200 p-3.5 rounded-xl shadow-2xl flex items-start justify-between gap-3 border animate-bounce">
            <div className="flex items-start gap-2">
              <Bell className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span className="text-xs font-semibold leading-relaxed">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(undefined)}
              className="text-blue-400 hover:text-white p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Application Body */}
        <main className="flex-1 relative">
          <Routes>
            <Route path="/" element={<PlannerPage setToastMessage={setToastMessage} />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
