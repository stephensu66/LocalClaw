import { NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { useAgentStatus } from '../hooks/useAgent';

export function AppLayout() {
  const { t } = useI18n();
  const agentStatus = useAgentStatus();
  const brandUrl = String(import.meta.env.VITE_BRAND_URL ?? '').trim();
  const hasBrandUrl = brandUrl.length > 0;
  const brandLetters = [
    { char: 'L', color: '#4285F4' },
    { char: 'o', color: '#EA4335' },
    { char: 'c', color: '#FBBC05' },
    { char: 'a', color: '#4285F4' },
    { char: 'l', color: '#34A853' },
    { char: 'C', color: '#EA4335' },
    { char: 'l', color: '#FBBC05' },
    { char: 'a', color: '#4285F4' },
    { char: 'w', color: '#34A853' },
  ] as const;

  const status = agentStatus.data?.status;
  const isLoadingStatus = agentStatus.isLoading && !agentStatus.data;
  let agentStatusText = t('agentStopped');
  let agentStatusColor = '#dc2626';
  let agentStatusBorder = 'rgba(220,38,38,0.25)';

  if (isLoadingStatus) {
    agentStatusText = t('loading');
    agentStatusColor = '#64748b';
    agentStatusBorder = 'rgba(100,116,139,0.25)';
  } else if (status === 'ok') {
    agentStatusText = t('agentRunning');
    agentStatusColor = '#16a34a';
    agentStatusBorder = 'rgba(22,163,74,0.25)';
  } else if (status === 'degraded') {
    agentStatusText = t('agentDegraded');
    agentStatusColor = '#f59e0b';
    agentStatusBorder = 'rgba(245,158,11,0.3)';
  }

  const handleSwitchToOpenClaw = async () => {
    try {
      await api.switchToOpenClaw();
      // Optionally, show a success message or navigate
    } catch (error) {
      alert('Failed to switch to OpenClaw dashboard');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <a
            href={hasBrandUrl ? brandUrl : undefined}
            target={hasBrandUrl ? '_blank' : undefined}
            rel={hasBrandUrl ? 'noreferrer' : undefined}
            className={`brand-link${hasBrandUrl ? '' : ' disabled'}`}
            aria-label={t('appName')}
            onClick={(event) => {
              if (!hasBrandUrl) {
                event.preventDefault();
              }
            }}
          >
            <span className="brand-mark">
              {brandLetters.map((item, index) => (
                <span key={`${item.char}-${index}`} style={{ color: item.color }}>
                  {item.char}
                </span>
              ))}
            </span>
          </a>
          <div className="brand-muted">{t('consoleSubtitle')}</div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('chat')}
          </NavLink>
          <NavLink to="/agents/new" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('addAgent')}
          </NavLink>
          <NavLink to="/models/new" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('addModel')}
          </NavLink>
          <NavLink to="/agent" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('agentStatus')}
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('tasks')}
          </NavLink>
          <NavLink to="/permissions" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('permissions')}
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('settings')}
          </NavLink>
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: agentStatusColor,
              background: 'rgba(0,0,0,0.03)',
              padding: '6px 8px',
              borderRadius: 8,
              border: `1px solid ${agentStatusBorder}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: agentStatusColor,
                display: 'inline-block',
              }}
            />
            <span>{agentStatusText}</span>
          </div>
          <Button onClick={handleSwitchToOpenClaw}>
            {t('switchToOpenClaw')}
          </Button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
