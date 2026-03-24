import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAgentList, useAgentModel, useAgentStatus, useAgentWorkspace, useEnvCheck } from '../hooks/useAgent';
import { useI18n } from '../i18n';
import { useEffect } from 'react';
import { useAgentStore } from '../stores/agentStore';

export function AgentStatus() {
  const { t } = useI18n();
  const statusQuery = useAgentStatus();
  const envCheck = useEnvCheck();
  const { selectedAgentName, setSelectedAgentName } = useAgentStore();
  const agentListQuery = useAgentList();
  const hasLoadedAgents = Boolean(agentListQuery.data && agentListQuery.data.length > 0);
  const isAgentReady = hasLoadedAgents && agentListQuery.data!.includes(selectedAgentName);
  const agentModelQuery = useAgentModel(isAgentReady ? selectedAgentName : null);
  const agentWorkspaceQuery = useAgentWorkspace(isAgentReady ? selectedAgentName : null);
  const currentModel = agentModelQuery.data?.model ?? null;
  const currentProvider = currentModel?.split('/')?.[0] ?? null;
  const currentWorkspace = agentWorkspaceQuery.data?.workspace ?? null;

  useEffect(() => {
    if (!agentListQuery.data || agentListQuery.data.length === 0) return;
    if (!agentListQuery.data.includes(selectedAgentName)) {
      setSelectedAgentName(agentListQuery.data[0]);
    }
  }, [agentListQuery.data, selectedAgentName, setSelectedAgentName]);

  const status = statusQuery.data?.status ?? 'down';
  const statusMessage =
    statusQuery.data?.message === 'OpenClaw CLI available'
      ? t('openclawCliAvailable')
      : (statusQuery.data?.message ?? t('noDetailsYet'));

  const handleRefresh = () => {
    void statusQuery.refetch();
    void agentListQuery.refetch();
    if (isAgentReady) {
      void agentModelQuery.refetch();
      void agentWorkspaceQuery.refetch();
    }
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <h2 className="page-title">{t('agentStatus')}</h2>
        <Button className="secondary" onClick={handleRefresh}>
          {t('refresh')}
        </Button>
      </div>

      <Card>
        <h3>{t('health')}</h3>
        <p className="muted">{t('agentHeartbeat')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-dot status-${status === 'ok' ? 'ok' : status === 'degraded' ? 'warn' : 'down'}`} />
          <strong>{status.toUpperCase()}</strong>
        </div>
        <p className="muted">{statusMessage}</p>
      </Card>

      <Card>
        <h3>{t('agentConfig')}</h3>
        <div className="grid grid-2">
          <div>
            <div className="muted">{t('agent')}</div>
            <strong>{selectedAgentName || '-'}</strong>
          </div>
          <div>
            <div className="muted">{t('provider')}</div>
            <strong>{currentProvider ?? '-'}</strong>
          </div>
          <div>
            <div className="muted">{t('modelName')}</div>
            <strong>{currentModel ?? '-'}</strong>
          </div>
          <div>
            <div className="muted">{t('workDir')}</div>
            <strong>{currentWorkspace ?? '-'}</strong>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="muted">{t('tools')}</div>
          <div className="badge" style={{ marginRight: 8 }}>{t('toolFile')}</div>
          <div className="badge" style={{ marginRight: 8 }}>{t('toolShell')}</div>
          <div className="badge" style={{ marginRight: 8 }}>{t('toolPython')}</div>
          <div className="badge">{t('toolBrowser')}</div>
        </div>
      </Card>

      <Card>
        <h3>{t('envCheck')}</h3>
        <p className="muted">{t('envCheckHint')}</p>
        <Button onClick={() => envCheck.mutate()} disabled={envCheck.isPending}>
          {t('runCheck')}
        </Button>
        {envCheck.data && (
          <div style={{ marginTop: 12 }}>
            <strong>{envCheck.data.status.toUpperCase()}</strong>
            <div className="muted">{envCheck.data.summary}</div>
          </div>
        )}
      </Card>
    </div>
  );
}
