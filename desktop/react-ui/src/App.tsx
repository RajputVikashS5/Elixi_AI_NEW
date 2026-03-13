import React, { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSettingsStore } from './store/settingsStore';
import { Sidebar } from './components/ui/Sidebar';
import { TopBar } from './components/ui/TopBar';

const AmbientOrb = lazy(() => import('./components/ui/AmbientOrb').then((m) => ({ default: m.AmbientOrb })));
const FloatingWidget = lazy(() => import('./components/ui/FloatingWidget').then((m) => ({ default: m.FloatingWidget })));
const ContextualHud = lazy(() => import('./components/ui/ContextualHud').then((m) => ({ default: m.ContextualHud })));

const ChatPage = lazy(() => import('./pages/ChatPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AutomationPage = lazy(() => import('./pages/AutomationPage'));
const MemoryPage = lazy(() => import('./pages/MemoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const App: React.FC = () => {
  const { personalityMode } = useSettingsStore();
  const [showEnhancements, setShowEnhancements] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowEnhancements(true);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div
        className="relative flex h-screen flex-col overflow-hidden bg-elixi-bg text-elixi-text"
        data-personality={personalityMode}
      >
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(58%_80%_at_10%_84%,rgba(34,211,238,0.24),transparent_58%),radial-gradient(62%_84%_at_87%_76%,rgba(168,85,247,0.22),transparent_58%),linear-gradient(128deg,#060913,#0b1332_46%,#080f2a)]" />
        <div className="pointer-events-none absolute -left-32 top-20 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-28 bottom-12 h-[460px] w-[460px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(130deg,transparent_18%,rgba(34,211,238,0.13)_44%,transparent_63%)]" />
        {/* Frameless window title bar / drag region */}
        <TopBar />
        {showEnhancements && (
          <Suspense fallback={null}>
            <FloatingWidget />
            <ContextualHud />
            <AmbientOrb />
          </Suspense>
        )}

        <div className="z-10 m-6 mt-3 flex flex-1 overflow-hidden rounded-[28px] border border-cyan-200/15 bg-slate-950/30 shadow-[0_30px_120px_rgba(2,8,24,0.65)] backdrop-blur-md">
          <main className="relative flex-1 overflow-hidden border-r border-cyan-200/10">
            <Suspense fallback={<div className="h-full w-full" />}>
              <Routes>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/automation" element={<AutomationPage />} />
                <Route path="/memory" element={<MemoryPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </main>

          <Sidebar />
        </div>
      </div>
    </HashRouter>
  );
};

export default App;
