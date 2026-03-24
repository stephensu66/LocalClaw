import { useEffect, useRef, useState } from 'react';
import { localConfigUpdateSchema } from '@openclaw/shared';
import type { LocalConfigInput, ModelMode } from '@openclaw/shared';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Switch } from '../components/Switch';
import { Button } from '../components/Button';
import { useSettingsStore } from '../stores/settingsStore';
import { useI18n } from '../i18n';
import { getBackendModelName } from '../data/modelProviders';
import { getTier1Options, parseModelName, resolveProviderBaseUrl, type Tier1Entry } from '../data/modelCatalog';

function formatInputTypeLabel(input: string | undefined, locale: 'zh' | 'en') {
  if (!input) return null;
  if (locale !== 'zh') return input;
  const normalized = input.trim().toLowerCase();
  if (normalized === 'text') return '文本';
  if (normalized === 'text+image') return '文本+图像';
  if (normalized === 'image') return '图像';
  if (normalized === 'audio') return '音频';
  if (normalized === 'video') return '视频';
  return input;
}

export function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { config, loadConfig, updateConfig } = useSettingsStore();
  const defaultForm: LocalConfigInput = {
    modelMode: 'builtin',
    apiKey: null,
    baseUrl: null,
    customModelName: null,
    modelName: 'openai/gpt-4o',
    workDirAuto: true,
    workDir: '',
    notificationsEnabled: true,
  };
  const [form, setForm] = useState<LocalConfigInput>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tier1, setTier1] = useState<ModelMode>('builtin');
  const [tier2, setTier2] = useState<string>('openai');
  const [hoverTier1, setHoverTier1] = useState<ModelMode | null>(null);
  const [hoverTier2, setHoverTier2] = useState<string | null>(null);
  const [tier3, setTier3] = useState<string>('');
  const [isTierMenuOpen, setIsTierMenuOpen] = useState(false);
  const tierMenuRef = useRef<HTMLDivElement | null>(null);

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config) {
      const parsed = parseModelName(config.modelName);
      setForm({
        modelMode: config.modelMode,
        apiKey: null,
        baseUrl: config.baseUrl ?? null,
        customModelName: config.customModelName ?? null,
        modelName: config.modelName ?? getBackendModelName(config.modelMode),
        workDirAuto: config.workDirAuto,
        workDir: config.workDir,
        notificationsEnabled: config.notificationsEnabled,
      });
      setTier1(config.modelMode);
      setTier2(parsed?.providerId ?? 'openai');
      setTier3(parsed?.modelId ?? '');
      setHoverTier1(null);
      setHoverTier2(null);
      setIsTierMenuOpen(false);
    }
  }, [config]);

  useEffect(() => {
    if (!isTierMenuOpen) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (tierMenuRef.current?.contains(event.target as Node)) return;
      setIsTierMenuOpen(false);
      setHoverTier1(null);
      setHoverTier2(null);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
    };
  }, [isTierMenuOpen]);

  const onSave = async () => {
    const trimmedApiKey = form.apiKey?.trim() ?? '';
    const providerId = parseModelName(form.modelName)?.providerId?.trim() ?? '';
    const requiredErrors: Record<string, string> = {};

    if (!providerId) {
      requiredErrors.modelProvider = t('providerRequired');
    }
    if (Object.keys(requiredErrors).length > 0) {
      setErrors(requiredErrors);
      return;
    }

    const payload: Partial<LocalConfigInput> = {
      modelMode: form.modelMode,
      baseUrl: form.baseUrl,
      customModelName: form.customModelName,
      modelName: form.modelName,
      workDirAuto: form.workDirAuto,
      workDir: form.workDir,
      notificationsEnabled: form.notificationsEnabled,
    };
    if (trimmedApiKey) payload.apiKey = trimmedApiKey;

    const parsed = localConfigUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        next[issue.path.join('.')] = issue.message;
      });
      setErrors(next);
      return;
    }
    await updateConfig(payload);
    setErrors({});
  };

  const updateTier1 = (value: ModelMode) => {
    const nextTier1 = value;
    const entry = getTier1Options().find((item) => item.id === nextTier1);
    const nextTier2 = entry?.providers[0]?.id ?? 'openai';
    const nextTier3 = entry?.providers[0]?.models[0]?.id ?? '';
    const baseUrl = resolveProviderBaseUrl(entry?.providers[0], nextTier1, locale);
    setTier1(nextTier1);
    setTier2(nextTier2);
    setTier3(nextTier3);
    setHoverTier1(nextTier1);
    setHoverTier2(null);
    clearFieldError('modelProvider');
    setForm((prev) => ({
      ...prev,
      modelMode: nextTier1,
      baseUrl: baseUrl ?? (nextTier1 === 'other' ? prev.baseUrl ?? null : null),
      customModelName: nextTier1 === 'other' ? prev.customModelName ?? '' : null,
      modelName: nextTier3 ? `${nextTier2}/${nextTier3}` : getBackendModelName(nextTier1),
    }));
  };

  const updateTier2 = (value: string, entry: Tier1Entry | undefined, parentTier1: ModelMode) => {
    const provider = entry?.providers.find((item) => item.id === value);
    const nextTier3 = provider?.models[0]?.id ?? '';
    const baseUrl = resolveProviderBaseUrl(provider, parentTier1, locale);
    setTier1(parentTier1);
    setTier2(value);
    setTier3(nextTier3);
    setHoverTier1(parentTier1);
    setHoverTier2(value);
    clearFieldError('modelProvider');
    setForm((prev) => ({
      ...prev,
      modelMode: parentTier1,
      baseUrl: baseUrl ?? (parentTier1 === 'other' ? prev.baseUrl ?? null : null),
      customModelName: parentTier1 === 'other' ? prev.customModelName ?? '' : null,
      modelName: nextTier3 ? `${value}/${nextTier3}` : getBackendModelName(parentTier1),
    }));
  };

  const updateTier3 = (value: string, providerId: string, parentTier1: ModelMode, entry: Tier1Entry | undefined) => {
    const provider = entry?.providers.find((item) => item.id === providerId);
    const baseUrl = resolveProviderBaseUrl(provider, parentTier1, locale);
    setTier1(parentTier1);
    setTier2(providerId);
    setTier3(value);
    setHoverTier1(null);
    setHoverTier2(null);
    setIsTierMenuOpen(false);
    clearFieldError('modelProvider');
    setForm((prev) => ({
      ...prev,
      modelMode: parentTier1,
      baseUrl: baseUrl ?? (parentTier1 === 'other' ? prev.baseUrl ?? null : null),
      customModelName: parentTier1 === 'other' ? prev.customModelName ?? '' : null,
      modelName: `${providerId}/${value}`,
    }));
  };

  const tier1Options = getTier1Options();
  const activeTier1 = tier1Options.find((item) => item.id === tier1);
  const hoverTier1Entry = hoverTier1 ? tier1Options.find((item) => item.id === hoverTier1) : undefined;
  const activeTier2Id = hoverTier2 ?? (hoverTier1Entry?.id === tier1 ? tier2 : null);
  const hoverProvider =
    hoverTier2 && hoverTier1Entry ? hoverTier1Entry.providers.find((item) => item.id === hoverTier2) : undefined;
  const selectedTier1Label = activeTier1?.label[locale] ?? tier1;
  const currentProviderId = parseModelName(form.modelName)?.providerId?.trim() ?? '';
  const currentProviderLabel =
    activeTier1?.providers.find((item) => item.id === currentProviderId)?.label[locale] ?? currentProviderId;
  const hasProvider = Boolean(currentProviderId);
  const hasApiKeyInput = Boolean(form.apiKey?.trim());
  const hasConfiguredApiKey = Boolean(config?.apiKeySet);
  const hasApiKey = hasApiKeyInput || hasConfiguredApiKey;
  const canSave = hasProvider;

  const toggleTierMenu = () => {
    setIsTierMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setHoverTier1(null);
        setHoverTier2(null);
      }
      return next;
    });
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <h2 className="page-title">{t('settings')}</h2>
        <Button onClick={onSave} disabled={!canSave}>
          {t('save')}
        </Button>
      </div>

      <Card>
        <div className="form-row">
          <label>
            {t('language')}
            <Select value={locale} onChange={(e) => setLocale(e.target.value as 'zh' | 'en')}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </Select>
            <div className="muted" style={{ marginTop: 6 }}>
              {locale === 'zh' ? '语言修改会立即生效。' : 'Language changes apply immediately.'}
            </div>
          </label>
        </div>
      </Card>

      <Card>
        <div className="muted" style={{ marginBottom: 12 }}>
          {locale === 'zh'
            ? '这些设置可随时修改，保存后立即生效。'
            : 'You can change these settings anytime. Changes apply immediately.'}
        </div>
        <div className="form-row">
          <label>
            {t('modelMode')}
            <div className="model-tier-picker" ref={tierMenuRef}>
              <button
                type="button"
                className={`model-tier-trigger ${isTierMenuOpen ? 'open' : ''}`}
                aria-expanded={isTierMenuOpen}
                onClick={toggleTierMenu}
              >
                <span className="model-tier-trigger-main">{selectedTier1Label}</span>
                <span className="model-tier-trigger-meta">{form.modelName}</span>
                <span className={`model-tier-trigger-caret ${isTierMenuOpen ? 'open' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
              {isTierMenuOpen && (
                <div className="model-tier-panel">
                  <div className="model-tier">
                    <div className="model-tier-column">
                      <div className="model-tier-title">{t('model')}</div>
                      <div className="model-tier-list">
                        {tier1Options.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`model-tier-item ${(hoverTier1 ?? tier1) === item.id ? 'active' : ''}`}
                            onMouseEnter={() => {
                              setHoverTier1(item.id);
                              setHoverTier2(null);
                            }}
                            onClick={() => updateTier1(item.id)}
                          >
                            {item.label[locale]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {hoverTier1Entry && (
                      <div className="model-tier-column">
                        <div className="model-tier-title">{t('provider')}</div>
                        <div className="model-tier-list">
                          {(hoverTier1Entry.providers ?? []).map((provider) => (
                            <button
                              key={provider.id}
                              type="button"
                              className={`model-tier-item ${activeTier2Id === provider.id ? 'active' : ''}`}
                              onMouseEnter={() => setHoverTier2(provider.id)}
                              onClick={() => updateTier2(provider.id, hoverTier1Entry, hoverTier1Entry.id)}
                            >
                              {provider.label[locale]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {hoverTier1Entry && hoverProvider && (
                      <div className="model-tier-column">
                        <div className="model-tier-title">{t('modelParams')}</div>
                        <div className="model-tier-list">
                          {(hoverProvider.models ?? []).map((model) => {
                            const modelLabel = model.label ? model.label[locale] : model.id;
                            const inputTypeLabel = formatInputTypeLabel(model.input, locale);
                            const meta = [
                              inputTypeLabel ? `${t('inputType')}: ${inputTypeLabel}` : null,
                              model.ctx ? `${t('contextWindow')}: ${model.ctx}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ');
                            return (
                              <button
                                key={`${model.id}-${model.input ?? ''}-${model.ctx ?? ''}`}
                                type="button"
                                className={`model-tier-item ${
                                  tier1 === hoverTier1Entry.id && tier2 === hoverProvider.id && tier3 === model.id
                                    ? 'active'
                                    : ''
                                }`}
                                onClick={() =>
                                  updateTier3(model.id, hoverProvider.id, hoverTier1Entry.id, hoverTier1Entry)
                                }
                              >
                                <div className="model-tier-item-title">{modelLabel}</div>
                                {meta && <div className="model-tier-item-meta">{meta}</div>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              {t('modelName')}: {form.modelName}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              {t('currentProvider')}: {currentProviderLabel || t('notSet')}
            </div>
            {(!hasProvider || errors.modelProvider) && (
              <div className="muted" style={{ marginTop: 4, color: 'var(--danger)' }}>
                {errors.modelProvider ?? t('providerRequired')}
              </div>
            )}
          </label>

          <label>
            {t('apiKeyOptional')}
            <Input
              placeholder="..."
              value={form.apiKey ?? ''}
              onChange={(e) => {
                clearFieldError('apiKey');
                setForm({ ...form, apiKey: e.target.value || null });
              }}
            />
            <div className="muted" style={{ marginTop: 4 }}>
              {t('apiKeyStatus')}: {hasApiKey ? t('apiKeyConfigured') : t('notSet')}
            </div>
            {errors.apiKey && (
              <div className="muted" style={{ marginTop: 4, color: 'var(--danger)' }}>
                {errors.apiKey}
              </div>
            )}
          </label>

          {/* <label>
            {t('baseUrlOptional')}
            <Input
              placeholder="https://api.example.com"
              value={form.baseUrl ?? ''}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value || null })}
            />
            {errors.baseUrl && <div className="muted">{errors.baseUrl}</div>}
          </label> */}

          {form.modelMode === 'other' && (
            <label>
              {t('customModelName')}
              <Input
                placeholder="Custom Provider"
                value={form.customModelName ?? ''}
                onChange={(e) => setForm({ ...form, customModelName: e.target.value || null })}
              />
              {errors.customModelName && <div className="muted">{errors.customModelName}</div>}
            </label>
          )}

          <Switch
            checked={form.notificationsEnabled}
            onChange={(e) => setForm({ ...form, notificationsEnabled: e.target.checked })}
          >
            {t('notifications')}
          </Switch>
        </div>
      </Card>
    </div>
  );
}
