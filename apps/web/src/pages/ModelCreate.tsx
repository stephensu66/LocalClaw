import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LocalConfigInput, ModelMode } from '@openclaw/shared';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
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

interface ModelFormState {
  modelMode: ModelMode;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  customModelName: string;
}

export function ModelCreate() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { config, loadConfig, updateConfig, loading } = useSettingsStore();

  const [form, setForm] = useState<ModelFormState>({
    modelMode: 'builtin',
    modelName: 'openai/gpt-4o',
    apiKey: '',
    baseUrl: '',
    customModelName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedMessage, setSavedMessage] = useState<string>('');
  const [submitError, setSubmitError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tier1, setTier1] = useState<ModelMode>('builtin');
  const [tier2, setTier2] = useState<string>('openai');
  const [hoverTier1, setHoverTier1] = useState<ModelMode | null>(null);
  const [hoverTier2, setHoverTier2] = useState<string | null>(null);
  const [tier3, setTier3] = useState<string>('');
  const [isTierMenuOpen, setIsTierMenuOpen] = useState(false);
  const tierMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!config) return;
    const parsed = parseModelName(config.modelName);
    setForm({
      modelMode: config.modelMode,
      modelName: config.modelName,
      apiKey: '',
      baseUrl: config.baseUrl ?? '',
      customModelName: config.customModelName ?? '',
    });
    setTier1(config.modelMode);
    setTier2(parsed?.providerId ?? 'openai');
    setTier3(parsed?.modelId ?? '');
    setHoverTier1(null);
    setHoverTier2(null);
    setIsTierMenuOpen(false);
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

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
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
      modelName: nextTier3 ? `${nextTier2}/${nextTier3}` : getBackendModelName(nextTier1),
      baseUrl: baseUrl ?? (nextTier1 === 'other' ? prev.baseUrl : ''),
      customModelName: nextTier1 === 'other' ? prev.customModelName : '',
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
      modelName: nextTier3 ? `${value}/${nextTier3}` : getBackendModelName(parentTier1),
      baseUrl: baseUrl ?? (parentTier1 === 'other' ? prev.baseUrl : ''),
      customModelName: parentTier1 === 'other' ? prev.customModelName : '',
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
      modelName: `${providerId}/${value}`,
      baseUrl: baseUrl ?? (parentTier1 === 'other' ? prev.baseUrl : ''),
      customModelName: parentTier1 === 'other' ? prev.customModelName : '',
    }));
  };

  const onSave = async () => {
    if (isSubmitting) return;
    const nextErrors: Record<string, string> = {};
    const apiKey = form.apiKey.trim();
    setSubmitError('');
    if (!currentProviderId) {
      nextErrors.modelProvider = t('providerRequired');
    }
    if (!apiKey) {
      nextErrors.apiKey = t('apiKeyRequired');
    }
    if (form.modelMode === 'other') {
      if (!form.customModelName.trim()) {
        nextErrors.customModelName = t('customModelName');
      }
      if (!form.baseUrl.trim()) {
        nextErrors.baseUrl = t('baseUrlOptional');
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<LocalConfigInput> = {
        modelMode: form.modelMode,
        modelName: form.modelName,
        apiKey,
        baseUrl: form.baseUrl.trim() ? form.baseUrl.trim() : null,
        customModelName: form.customModelName.trim() ? form.customModelName.trim() : null,
      };

      await updateConfig(payload);
      setSavedMessage(locale === 'zh' ? '模型配置已保存并应用。' : 'Model configuration saved and applied.');
      setErrors({});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmitError(locale === 'zh' ? `保存失败：${message}` : `Save failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || loading;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <h2 className="page-title">{t('addModel')}</h2>
        <Button
          className="secondary"
          onClick={() => navigate('/')}
          disabled={isBusy}
        >
          {locale === 'zh' ? '取消' : 'Cancel'}
        </Button>
      </div>

      <Card>
        <div className="muted" style={{ marginBottom: 12 }}>
          {locale === 'zh'
            ? '在这里配置模型提供方与 API Key，保存后会应用到当前运行环境。'
            : 'Configure model provider and API key here. Changes apply to current runtime after save.'}
        </div>
        <div className="form-row">
          <label>
            {t('modelMode')}
            <div className="model-tier-picker" ref={tierMenuRef}>
              <button
                type="button"
                className={`model-tier-trigger ${isTierMenuOpen ? 'open' : ''}`}
                aria-expanded={isTierMenuOpen}
                onClick={() => setIsTierMenuOpen((prev) => !prev)}
                disabled={isBusy}
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
                            disabled={isBusy}
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
                              disabled={isBusy}
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
                                disabled={isBusy}
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
            {errors.modelProvider && (
              <div className="muted" style={{ marginTop: 4, color: 'var(--danger)' }}>
                {errors.modelProvider}
              </div>
            )}
          </label>

          <label>
            {t('apiKeyOptional')}
            <Input
              placeholder="..."
              value={form.apiKey}
              onChange={(e) => {
                clearFieldError('apiKey');
                setSavedMessage('');
                setSubmitError('');
                setForm((prev) => ({ ...prev, apiKey: e.target.value }));
              }}
              disabled={isBusy}
            />
            {errors.apiKey && (
              <div className="muted" style={{ marginTop: 4, color: 'var(--danger)' }}>
                {errors.apiKey}
              </div>
            )}
          </label>

          {form.modelMode === 'other' && (
            <>
              <label>
                {t('customModelName')}
                <Input
                  placeholder="Custom Provider"
                  value={form.customModelName}
                  onChange={(e) => {
                    clearFieldError('customModelName');
                    setForm((prev) => ({ ...prev, customModelName: e.target.value }));
                  }}
                  disabled={isBusy}
                />
                {errors.customModelName && (
                  <div className="muted" style={{ marginTop: 4, color: 'var(--danger)' }}>
                    {errors.customModelName}
                  </div>
                )}
              </label>
              <label>
                {t('baseUrlOptional')}
                <Input
                  placeholder="https://api.example.com"
                  value={form.baseUrl}
                  onChange={(e) => {
                    clearFieldError('baseUrl');
                    setForm((prev) => ({ ...prev, baseUrl: e.target.value }));
                  }}
                  disabled={isBusy}
                />
                {errors.baseUrl && (
                  <div className="muted" style={{ marginTop: 4, color: 'var(--danger)' }}>
                    {errors.baseUrl}
                  </div>
                )}
              </label>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Button onClick={onSave} disabled={isBusy}>
            {locale === 'zh' ? '增加模型' : 'Add Model'}
          </Button>
          <Button className="secondary" onClick={() => navigate('/')} disabled={isBusy}>
            {locale === 'zh' ? '取消' : 'Cancel'}
          </Button>
        </div>
      </Card>

      <Card>
        <h3>{locale === 'zh' ? '当前生效配置' : 'Current Effective Config'}</h3>
        <div className="grid grid-2">
          <div>
            <div className="muted">{t('modelMode')}</div>
            <strong>{form.modelMode}</strong>
          </div>
          <div>
            <div className="muted">{t('modelName')}</div>
            <strong>{form.modelName}</strong>
          </div>
          <div>
            <div className="muted">{t('baseUrl')}</div>
            <strong>{form.baseUrl || '-'}</strong>
          </div>
        </div>
        {savedMessage && (
          <div className="muted" style={{ marginTop: 10, color: '#166534' }}>
            {savedMessage}
          </div>
        )}
        {submitError && (
          <div className="muted" style={{ marginTop: 10, color: 'var(--danger)' }}>
            {submitError}
          </div>
        )}
      </Card>
    </div>
  );
}
