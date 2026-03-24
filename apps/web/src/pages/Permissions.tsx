import type { PermissionKey } from '@openclaw/shared';
import { Card } from '../components/Card';
import { Switch } from '../components/Switch';
import { usePermissions, useUpdatePermission } from '../hooks/usePermissions';
import { useI18n } from '../i18n';

const permissionDescriptions: Record<'en' | 'zh', Record<PermissionKey, string>> = {
  en: {
    FILE_READ: 'Allow reading files.',
    FILE_WRITE: 'Allow writing files.',
    SHELL_EXEC: 'Allow executing shell commands.',
    PYTHON_EXEC: 'Allow running Python.',
    INTERNET_ACCESS: 'Allow accessing the internet.',
    BROWSER: 'Allow browser automation.',
  },
  zh: {
    FILE_READ: '允许读取文件。',
    FILE_WRITE: '允许写入文件。',
    SHELL_EXEC: '允许执行 shell 命令。',
    PYTHON_EXEC: '允许运行 Python。',
    INTERNET_ACCESS: '允许访问互联网。',
    BROWSER: '允许浏览器自动化。',
  },
};

const READONLY_PERMISSION_KEYS = new Set<PermissionKey>([
  'FILE_READ',
  'FILE_WRITE',
  'INTERNET_ACCESS',
  'BROWSER',
]);

export function Permissions() {
  const { t, locale } = useI18n();
  const permissions = usePermissions();
  const update = useUpdatePermission();

  const groups = [
    {
      title: locale === 'zh' ? '文件权限' : 'File Permissions',
      keys: ['FILE_READ', 'FILE_WRITE'] as PermissionKey[],
    },
    {
      title: locale === 'zh' ? '网络权限' : 'Network Permissions',
      keys: ['INTERNET_ACCESS', 'BROWSER'] as PermissionKey[],
    },
  ];

  const items = permissions.data ?? [];

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <h2 className="page-title">{t('permissions')}</h2>
      </div>

      <Card>
        <div className="muted" style={{ marginBottom: 12 }}>
          {locale === 'zh'
            ? '权限决定 Agent 可以做什么。建议只开启当前任务需要的权限。'
            : 'Permissions decide what the agent can do. Only enable what you need.'}
        </div>
        <div className="permissions-groups">
          {groups.map((group) => (
            <section key={group.title} className="permission-group">
              <div className="permission-group-title">{group.title}</div>
              <div className="permission-group-body">
              {group.keys.map((key) => {
                const perm = items.find((item) => item.key === key);
                const isReadonly = READONLY_PERMISSION_KEYS.has(key);
                const isDisabled = isReadonly || permissions.isLoading || update.isPending;
                return (
                  <div key={key} className="permission-item">
                    <div className="permission-item-info">
                      <div className="permission-item-key">{key}</div>
                      <div className="muted">{permissionDescriptions[locale][key]}</div>
                      {isReadonly && (
                        <div className="muted">
                          {locale === 'zh' ? '当前版本暂不支持修改。' : 'Not editable in current version.'}
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={perm?.granted ?? false}
                      disabled={isDisabled}
                      onChange={(e) => {
                        if (isDisabled) return;
                        update.mutate({ key, granted: e.target.checked });
                      }}
                    />
                  </div>
                );
              })}
              </div>
            </section>
          ))}

          <div className="permission-policy">
            <strong className="permission-policy-title">{locale === 'zh' ? '安全策略' : 'Safety Policy'}</strong>
            <div className="muted">
              {locale === 'zh' ? '高风险操作需要确认' : 'Require confirmation for high-risk actions'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
