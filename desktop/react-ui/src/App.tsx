import React, { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSettingsStore } from './store/settingsStore';
import { useVoiceStore } from './store/voiceStore';
import { voiceService } from './services/voiceService';
import { Sidebar } from './components/ui/Sidebar';
import { TopBar } from './components/ui/TopBar';
import { CameraPreview } from './components/ui/CameraPreview';

const AmbientOrb = lazy(() => import('./components/ui/AmbientOrb').then((m) => ({ default: m.AmbientOrb })));
const FloatingWidget = lazy(() => import('./components/ui/FloatingWidget').then((m) => ({ default: m.FloatingWidget })));
const ContextualHud = lazy(() => import('./components/ui/ContextualHud').then((m) => ({ default: m.ContextualHud })));

const ChatPage = lazy(() => import('./pages/ChatPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AutomationPage = lazy(() => import('./pages/AutomationPage'));
const MemoryPage = lazy(() => import('./pages/MemoryPage'));
const LearningPage = lazy(() => import('./pages/LearningPage'));
const IntegrationManager = lazy(() => import('./pages/IntegrationManager'));
const VoicePage = lazy(() => import('./pages/VoicePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const STARTUP_GREETING_SESSION_KEY = 'elixi_startup_greeted';
const STARTUP_GREETING_TEXT = 'Hello. ELIXI is online and ready to help you.';

const App: React.FC = () => {
  const { personalityMode } = useSettingsStore();
  const { setStatus } = useVoiceStore();
  const [showEnhancements, setShowEnhancements] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowEnhancements(true);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    // Startup speech is optional because TTS can be slow or unavailable in dev.
    if (import.meta.env.VITE_ENABLE_STARTUP_VOICE_GREETING !== '1') {
      return () => {
        canceled = true;
      };
    }

    const hasGreeted = window.sessionStorage.getItem(STARTUP_GREETING_SESSION_KEY) === '1';
    if (hasGreeted) {
      return;
    }

    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    const greetOnStartup = async () => {
      try {
        let healthy = false;
        // Only try 2 times instead of 4, total wait ~3 seconds max
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const status = await Promise.race([
              voiceService.getStatus(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000)),
            ]);
            const statusData = status as any;
            if (statusData?.engineHealthy) {
              healthy = true;
              break;
            }
          } catch (err) {
            // Health check failed or timed out, continue to next attempt
          }
          await sleep(1000 * (attempt + 1));
          if (canceled) {
            return;
          }
        }

        if (!healthy || canceled) {
          return;
        }

        // Use aggressive timeout for TTS - fail fast if voice engine is slow
        const ttsFuture = voiceService.tts(STARTUP_GREETING_TEXT);
        const ttsWithTimeout = Promise.race([
          ttsFuture,
          new Promise((_, reject) => setTimeout(() => reject(new Error('TTS timeout')), 30000)), // 30 sec max for startup
        ]);

        let tts: any;
        try {
          tts = await ttsWithTimeout;
        } catch (err) {
          // TTS failed, skip greeting
          if (canceled) setStatus('idle');
          return;
        }

        if (!tts?.success || !tts?.data?.audioBase64 || canceled) {
          return;
        }

        window.sessionStorage.setItem(STARTUP_GREETING_SESSION_KEY, '1');

        const mimeType = tts.data.mimeType || 'audio/wav';
        const audio = new Audio(`data:${mimeType};base64,${tts.data.audioBase64}`);

        audio.onended = () => {
          if (!canceled) {
            setStatus('idle');
          }
        };

        audio.onerror = () => {
          if (!canceled) {
            setStatus('idle');
          }
        };

        setStatus('speaking');
        await audio.play();
      } catch (err) {
        // Silently fail for startup greeting - voice optional
        if (!canceled) {
          setStatus('idle');
        }
      }
    };

    void greetOnStartup();

    return () => {
      canceled = true;
    };
  }, [setStatus]);

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

        <CameraPreview />

        <div className="z-10 m-6 mt-3 flex flex-1 overflow-hidden rounded-[28px] border border-cyan-200/15 bg-slate-950/30 shadow-[0_30px_120px_rgba(2,8,24,0.65)] backdrop-blur-md">
          <main className="relative flex-1 overflow-hidden border-r border-cyan-200/10">
            <Suspense fallback={<div className="h-full w-full" />}>
              <Routes>
                <Route path="/" element={<Navigate to="/voice" replace />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/automation" element={<AutomationPage />} />
                <Route path="/memory" element={<MemoryPage />} />
                <Route path="/learning" element={<LearningPage />} />
                <Route path="/integrations" element={<IntegrationManager />} />
                <Route path="/voice" element={<VoicePage />} />
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
