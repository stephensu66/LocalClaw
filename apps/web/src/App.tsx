import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
import { api } from './api/client';
import type { AgentModelsReadyReason } from './api/client';

const MODEL_CHECK_TIMEOUT_MS = 5_000;
const MODEL_CHECK_MAX_ATTEMPTS = 2;

function isAbortError(error: unknown): boolean {
  return (error as any)?.name === 'AbortError';
}

function mapModelReasonToMessage(t: (key: any) => string, reason?: AgentModelsReadyReason): string {
  if (reason === 'timeout') return t('gatewayModelCheckTimeoutNotice');
  if (reason === 'cli_unavailable') return t('gatewayCliUnavailableNotice');
  return t('gatewayModelNotReadyNotice');
}

export function App() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { onboarded, config, loading, loadConfig } = useSettingsStore();
  const [startupError, setStartupError] = useState<{ message: string; logPath?: string } | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [startupNotice, setStartupNotice] = useState<string | null>(null);
  const [retrySeed, setRetrySeed] = useState(0);
  const loadFailureCountRef = useRef(0);
  useEventStream();

  useEffect(() => {
    if (config || loading) return;
    const timer = window.setTimeout(() => {
      void loadConfig().then(() => {
        const latestState = useSettingsStore.getState();
        if (latestState.config) {
          loadFailureCountRef.current = 0;
          setStartupError(null);
          return;
        }

        if (!latestState.error) return;
        loadFailureCountRef.current += 1;
        if (loadFailureCountRef.current >= 3) {
          setStartupError((current) => current ?? { message: latestState.error ?? t('gatewayStartFailedDesc') });
        }
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [config, loading, loadConfig, t]);

  useEffect(() => {
    if (!config) {
      setModelsReady(false);
      setStartupNotice(null);
      return;
    }
    if (!onboarded) {
      setModelsReady(true);
      setStartupNotice(null);
      return;
    }

    let disposed = false;
    setModelsReady(false);
    setStartupNotice(null);

    const run = async () => {
      let latestError: string | null = null;
      let latestReason: AgentModelsReadyReason | undefined;
      for (let attempt = 0; attempt < MODEL_CHECK_MAX_ATTEMPTS; attempt += 1) {
        if (disposed) return;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), MODEL_CHECK_TIMEOUT_MS);

        try {
          const response = await api.listAgentModels({ signal: controller.signal });
          if (disposed) return;
          const models = response.models ?? [];
          queryClient.setQueryData(['agent-models'], models);
          const ready = response.ready ?? models.length > 0;
          if (ready) {
            setModelsReady(true);
            setStartupError(null);
            setStartupNotice(null);
            return;
          }

          latestReason = response.reason ?? 'not_configured';
          latestError = mapModelReasonToMessage(t, latestReason);
          setModelsReady(true);
          setStartupNotice(latestError);
          return;
        } catch (error) {
          if (isAbortError(error)) {
            latestReason = 'timeout';
            latestError = mapModelReasonToMessage(t, 'timeout');
          } else {
            latestReason = 'error';
            latestError = error instanceof Error ? error.message : mapModelReasonToMessage(t, 'error');
          }
          if (attempt < MODEL_CHECK_MAX_ATTEMPTS - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 600));
          }
        } finally {
          window.clearTimeout(timeout);
        }
      }

      if (!disposed) {
        setModelsReady(true);
        setStartupNotice(latestError ?? mapModelReasonToMessage(t, latestReason));
      }
    };

    void run();

    return () => {
      disposed = true;
    };
  }, [config, onboarded, queryClient, retrySeed, t]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    const hasTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!hasTauri) return;

    void import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        const stop = await listen<{ message?: string; logPath?: string }>(
          'local-service-startup-error',
          (event) => {
            const payload = event.payload ?? {};
            setStartupError({
              message: payload.message || t('gatewayStartFailedDesc'),
              logPath: payload.logPath,
            });
          }
        );
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch(() => {
        // no-op
      });

    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [t]);

  const handleRetry = () => {
    setStartupError(null);
    setStartupNotice(null);
    loadFailureCountRef.current = 0;
    setRetrySeed((value) => value + 1);
    void loadConfig();
  };

  const showBootScreen = !config || (onboarded && !modelsReady);
  if (showBootScreen) {
    const showFailure = Boolean(startupError);
    const preparingEnv = Boolean(config && onboarded && !showFailure);
    const title = showFailure
      ? t('gatewayStartFailedTitle')
      : preparingEnv
        ? t('gatewayPreparingEnvTitle')
        : t('gatewayStartingTitle');
    const desc = showFailure
      ? startupError?.message
      : preparingEnv
        ? t('gatewayPreparingEnvDesc')
        : t('gatewayStartingDesc');
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
          <h2 className="page-title" style={{ marginBottom: 10 }}>
            {title}
          </h2>
          <div className="muted">
            {desc}
          </div>
          {startupError?.logPath && (
            <div className="muted" style={{ marginTop: 8, wordBreak: 'break-all', textAlign: 'left' }}>
              {t('gatewayLogPathLabel')}: {startupError.logPath}
            </div>
          )}
          <button
            type="button"
            onClick={handleRetry}
            style={{
              marginTop: 16,
              borderRadius: 8,
              border: '1px solid #d6d6d6',
              padding: '8px 14px',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {t('gatewayRetry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {startupNotice && (
        <div style={{ padding: '8px 12px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', color: '#9a3412' }}>
          {startupNotice}
        </div>
      )}
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
    </>
  );
}
