import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { useTasks, useTaskLogs } from '../hooks/useTasks';
import { useI18n } from '../i18n';

function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return '-';
  const delta = new Date(end).getTime() - new Date(start).getTime();
  if (delta <= 0) return '-';
  const seconds = Math.floor(delta / 1000);
  return `${seconds}s`;
}

export function Tasks() {
  const { t } = useI18n();
  const tasksQuery = useTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const logsQuery = useTaskLogs(selectedId ?? undefined);

  const selected = tasksQuery.data?.find((task) => task.id === selectedId);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <h2 className="page-title">{t('tasks')}</h2>
      </div>

      <div className="grid grid-2">
        <Card>
          <h3>{t('tasks')}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('taskType')}</th>
                <th>{t('status')}</th>
                <th>{t('createdAt')}</th>
                <th>{t('duration')}</th>
              </tr>
            </thead>
            <tbody>
              {tasksQuery.data?.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => setSelectedId(task.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{task.id.slice(0, 6)}</td>
                  <td>{task.title ?? task.input.slice(0, 12)}</td>
                  <td>
                    <Badge>{task.status}</Badge>
                  </td>
                  <td>{new Date(task.createdAt).toLocaleString()}</td>
                  <td>{formatDuration(task.startedAt, task.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h3>{t('taskLogs')}</h3>
          {selected ? (
            <div className="form-row">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                <div>
                  <div className="muted">{t('taskType')}</div>
                  <strong>{selected.title ?? selected.input.slice(0, 20)}</strong>
                </div>
                <div>
                  <div className="muted">{t('agent')}</div>
                  <strong>{selected.agentName ?? '-'}</strong>
                </div>
                <div>
                  <div className="muted">{t('status')}</div>
                  <Badge>{selected.status}</Badge>
                </div>
              </div>
              <div className="muted">{selected.title ?? selected.input}</div>
              {logsQuery.data?.map((log) => (
                <div key={log.id}>
                  <strong>{log.level.toUpperCase()}</strong>
                  <div className="muted">{log.message}</div>
                </div>
              ))}
              {!logsQuery.data?.length && <div className="muted">{t('selectTaskHint')}</div>}
            </div>
          ) : (
            <p className="muted">{t('selectTaskHint')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
