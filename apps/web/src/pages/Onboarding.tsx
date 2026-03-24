import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localConfigInputSchema } from '@openclaw/shared';
import type { LocalConfigInput, ModelMode } from '@openclaw/shared';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Switch } from '../components/Switch';
import { useSettingsStore } from '../stores/settingsStore';
import { useI18n } from '../i18n';
import { getBackendModelName } from '../data/modelProviders';
import { getTier1Options, parseModelName, resolveProviderBaseUrl, type Tier1Entry } from '../data/modelCatalog';
import { pickDirectory } from '../utils/dirPicker';

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

export function Onboarding() {
  const { t, locale, setLocale } = useI18n();
  const { config, loadConfig, updateConfig } = useSettingsStore();
  const navigate = useNavigate();
  const [form, setForm] = useState<LocalConfigInput>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
    if (config.onboarded) {
      navigate('/');
      return;
    }
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
    const parsed = parseModelName(config.modelName);
    setTier1(config.modelMode);
    setTier2(parsed?.providerId ?? 'openai');
    setTier3(parsed?.modelId ?? '');
    setHoverTier1(null);
    setHoverTier2(null);
    setIsTierMenuOpen(false);
  }, [config, navigate]);

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

  const onSubmit = async () => {
    const parsed = localConfigInputSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        next[issue.path.join('.')] = issue.message;
      });
      setErrors(next);
      return;
    }
    await updateConfig(form);
    navigate('/');
  };

  return (
    <div className="grid" style={{ maxWidth: 720, margin: '0 auto', gap: 24 }}>
      <div>
        <h2 className="page-title">{t('welcomeTitle')}</h2>
        <p className="muted">{t('welcomeDesc')}</p>
      </div>

      <Card>
        <div className="form-row">
          <label>
            {t('language')}
            <Select value={locale} onChange={(e) => setLocale(e.target.value as 'zh' | 'en')}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </Select>
          </label>

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
                                className={`model-tier-item ${tier1 === hoverTier1Entry.id && tier2 === hoverProvider.id && tier3 === model.id
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
          </label>


          <label>
            {t('apiKeyOptional')}
            <Input
              placeholder="..."
              value={form.apiKey ?? ''}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value || null })}
            />
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

          <label>
            {t('workDir')}
            <Input
              placeholder="/Users/.../OpenClaw"
              value={form.workDir}
              onChange={(e) => setForm({ ...form, workDir: e.target.value })}
              disabled={form.workDirAuto}
            />
            {errors.workDir && <div className="muted">{errors.workDir}</div>}
          </label>

          <div>
            <Switch
              checked={form.workDirAuto}
              onChange={(e) => setForm({ ...form, workDirAuto: e.target.checked })}
            >
              {t('workDirAuto')}
            </Switch>
            <div className="muted">{t('workDirAutoHint')}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              className="secondary"
              type="button"
              onClick={async () => {
                const picked = await pickDirectory();
                if (picked) {
                  setForm((prev) => ({ ...prev, workDir: picked, workDirAuto: false }));
                }
              }}
              disabled={form.workDirAuto}
            >
              {t('browseDir')}
            </Button>
            <div className="muted">{t('browseDirHint')}</div>
          </div>

          <Switch
            checked={form.notificationsEnabled}
            onChange={(e) => setForm({ ...form, notificationsEnabled: e.target.checked })}
          >
            {t('notifications')}
          </Switch>
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onSubmit}>{t('finishSetup')}</Button>
      </div>
    </div>
  );
}
