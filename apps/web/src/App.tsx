import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AgentStatus } from './pages/AgentStatus';
import { Settings } from './pages/Settings';
import { Permissions } from './pages/Permissions';
import { Onboarding } from './pages/Onboarding';
import { useSettingsStore } from './stores/settingsStore';
import { useEventStream } from './hooks/useEventStream';
import { Chat } from './pages/Chat';
import { Tasks } from './pages/Tasks';
import { AgentCreate } from './pages/AgentCreate';
import { ModelCreate } from './pages/ModelCreate';
import { useI18n } from './i18n';

export function App() {
  const { t } = useI18n();
  const { onboarded, config, loading, loadConfig } = useSettingsStore();
  useEventStream();

  useEffect(() => {
    if (config || loading) return;
    const timer = window.setTimeout(() => {
      void loadConfig();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [config, loading, loadConfig]);

  if (!config) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
          <h2 className="page-title" style={{ marginBottom: 10 }}>{t('gatewayStartingTitle')}</h2>
          <div className="muted">{t('gatewayStartingDesc')}</div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/onboarding"
          element={onboarded
            ? <Navigate to="/" replace />
            : (
              <div style={{ padding: '40px 20px' }}>
                <Onboarding />
              </div>
            )}
        />
        <Route
          element={onboarded ? <AppLayout /> : <Navigate to="/onboarding" replace />}
        >
          <Route path="/" element={<Chat />} />
          <Route path="/agent" element={<AgentStatus />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/agents/new" element={<AgentCreate />} />
          <Route path="/models/new" element={<ModelCreate />} />
        </Route>
        <Route
          path="*"
          element={<Navigate to={onboarded ? '/' : '/onboarding'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
