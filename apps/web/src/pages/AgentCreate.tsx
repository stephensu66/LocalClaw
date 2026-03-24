import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { useCreateAgent, useAgentList, useAgentModelList } from '../hooks/useAgent';
import { useI18n } from '../i18n';
import type { AgentCreateStep, AgentCreateStepResult } from '../api/client';
import { useAgentStore } from '../stores/agentStore';

type StepStatus = 'idle' | 'running' | 'succeeded' | 'failed';

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const STEP_ORDER: AgentCreateStep[] = ['create_agent', 'init_session', 'restart_gateway'];

const EMPTY_STEP_STATUS: Record<AgentCreateStep, StepStatus> = {
  create_agent: 'idle',
  init_session: 'idle',
  restart_gateway: 'idle',
};

export function AgentCreate() {
  const { isZh } = useI18n();
  const navigate = useNavigate();
  const agentListQuery = useAgentList();
  const modelListQuery = useAgentModelList();
  const createAgentMutation = useCreateAgent();
  const { setSelectedAgentName } = useAgentStore();

  const [agentNameInput, setAgentNameInput] = useState('');
  const [model, setModel] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepStatus, setStepStatus] = useState<Record<AgentCreateStep, StepStatus>>({
    ...EMPTY_STEP_STATUS,
  });
  const [currentStep, setCurrentStep] = useState<AgentCreateStep | null>(null);
  const [stepResults, setStepResults] = useState<AgentCreateStepResult[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const labels = useMemo(
    () =>
      isZh
        ? {
          title: '新增 Agent',
          subtitle: '填写配置后将依次执行创建 Agent、初始化 session、重启 Gateway。',
          agentName: 'Agent Name',
          workspace: 'Workspace',
          agentDir: 'Agent Dir',
          model: 'Model',
          create: '创建 Agent',
          cancel: '取消',
          loadingModels: '正在加载模型列表...',
          noModels: '当前没有可用模型，请先检查 OpenClaw models 配置。',
          loadModelsFailed: '模型列表加载失败',
          loadAgentsFailed: 'Agent 列表加载失败',
          duplicateName: 'Agent 名称已存在',
          invalidName: 'Agent Name 只能包含字母、数字、下划线和中划线',
          requiredName: '请填写 Agent Name',
          requiredWorkspace: 'Workspace 不能为空',
          requiredAgentDir: 'Agent Dir 不能为空',
          requiredModel: '请选择 Model',
          stepLabels: {
            create_agent: '正在创建 Agent...',
            init_session: '正在初始化 session...',
            restart_gateway: '正在重启 Gateway...',
          } as Record<AgentCreateStep, string>,
          statusLabels: {
            idle: '待执行',
            running: '执行中',
            succeeded: '成功',
            failed: '失败',
          } as Record<StepStatus, string>,
          successPrefix: '创建成功：',
          failedPrefix: '创建失败：',
          details: '步骤详情',
        }
        : {
          title: 'Add Agent',
          subtitle: 'After submit, the app will create agent, initialize session, then restart gateway in order.',
          agentName: 'Agent Name',
          workspace: 'Workspace',
          agentDir: 'Agent Dir',
          model: 'Model',
          create: 'Create Agent',
          cancel: 'Cancel',
          loadingModels: 'Loading available models...',
          noModels: 'No models available. Please check OpenClaw models first.',
          loadModelsFailed: 'Failed to load model list',
          loadAgentsFailed: 'Failed to load agent list',
          duplicateName: 'Agent name already exists',
          invalidName: 'Agent name can only contain letters, digits, "_" and "-"',
          requiredName: 'Agent name is required',
          requiredWorkspace: 'Workspace is required',
          requiredAgentDir: 'Agent dir is required',
          requiredModel: 'Model is required',
          stepLabels: {
            create_agent: 'Creating agent...',
            init_session: 'Initializing session...',
            restart_gateway: 'Restarting gateway...',
          } as Record<AgentCreateStep, string>,
          statusLabels: {
            idle: 'Pending',
            running: 'Running',
            succeeded: 'Succeeded',
            failed: 'Failed',
          } as Record<StepStatus, string>,
          successPrefix: 'Created successfully: ',
          failedPrefix: 'Creation failed: ',
          details: 'Step details',
        },
    [isZh]
  );

  const normalizedAgentName = useMemo(
    () => agentNameInput.trim().toLowerCase(),
    [agentNameInput]
  );
  const workspace = normalizedAgentName ? `~/.openclaw/workspace-${normalizedAgentName}` : '';
  const agentDir = normalizedAgentName ? `~/.openclaw/agents/${normalizedAgentName}/agent` : '';
  const agents = agentListQuery.data ?? [];
  const models = modelListQuery.data ?? [];

  useEffect(() => {
    if (!model && models.length > 0) {
      setModel(models[0]);
    }
  }, [model, models]);

  const resetSubmitState = () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setStepResults([]);
    setStepStatus({ ...EMPTY_STEP_STATUS });
    setCurrentStep(null);
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!normalizedAgentName) {
      nextErrors.agentName = labels.requiredName;
    } else if (!AGENT_NAME_PATTERN.test(normalizedAgentName)) {
      nextErrors.agentName = labels.invalidName;
    } else if (agents.some((name) => name.toLowerCase() === normalizedAgentName)) {
      nextErrors.agentName = labels.duplicateName;
    }

    if (!workspace) {
      nextErrors.workspace = labels.requiredWorkspace;
    }
    if (!agentDir) {
      nextErrors.agentDir = labels.requiredAgentDir;
    }
    if (!model) {
      nextErrors.model = labels.requiredModel;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildStepStatusFromResults = (results: AgentCreateStepResult[]) => {
    const nextStatus: Record<AgentCreateStep, StepStatus> = { ...EMPTY_STEP_STATUS };
    results.forEach((step) => {
      nextStatus[step.step] = step.status === 'succeeded' ? 'succeeded' : 'failed';
    });
    return nextStatus;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!validate()) return;

    setStepResults([]);
    setCurrentStep('create_agent');
    setStepStatus({
      create_agent: 'running',
      init_session: 'idle',
      restart_gateway: 'idle',
    });

    try {
      const created = await createAgentMutation.mutateAsync({
        name: normalizedAgentName,
        workspace,
        agentDir,
        model,
      });
      setCurrentStep(null);
      setStepResults(created.steps);
      setStepStatus(buildStepStatusFromResults(created.steps));
      setSelectedAgentName(created.name);
      setSubmitSuccess(`${labels.successPrefix}${created.name}`);
      setErrors({});
    } catch (error) {
      const errorWithDetails = error as Error & {
        details?: {
          error?: string;
          step?: AgentCreateStep;
          steps?: AgentCreateStepResult[];
        };
      };
      const failedStep = errorWithDetails.details?.step ?? 'create_agent';
      const failedSteps = errorWithDetails.details?.steps ?? [];
      const nextStatus = buildStepStatusFromResults(failedSteps);
      nextStatus[failedStep] = 'failed';
      setCurrentStep(failedStep);
      setStepStatus(nextStatus);
      setStepResults(failedSteps);
      setSubmitError(`${labels.failedPrefix}${errorWithDetails.message}`);
    }
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-header">
        <h2 className="page-title">{labels.title}</h2>
        <Button
          className="secondary"
          onClick={() => {
            resetSubmitState();
            navigate(-1);
          }}
        >
          {labels.cancel}
        </Button>
      </div>

      <Card>
        <div className="muted" style={{ marginBottom: 12 }}>
          {labels.subtitle}
        </div>
        <div className="form-row">
          <label>
            {labels.agentName}
            <Input
              value={agentNameInput}
              onChange={(event) => {
                setAgentNameInput(event.target.value.toLowerCase());
                setErrors((prev) => ({ ...prev, agentName: '' }));
              }}
              placeholder={labels.requiredName}
              disabled={createAgentMutation.isPending}
            />
            {errors.agentName && (
              <div className="muted" style={{ color: 'var(--danger)', marginTop: 4 }}>
                {errors.agentName}
              </div>
            )}
          </label>

          <label>
            {labels.workspace}
            <Input value={workspace} disabled />
            {errors.workspace && (
              <div className="muted" style={{ color: 'var(--danger)', marginTop: 4 }}>
                {errors.workspace}
              </div>
            )}
          </label>

          <label>
            {labels.agentDir}
            <Input value={agentDir} disabled />
            {errors.agentDir && (
              <div className="muted" style={{ color: 'var(--danger)', marginTop: 4 }}>
                {errors.agentDir}
              </div>
            )}
          </label>

          <label>
            {labels.model}
            <Select
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setErrors((prev) => ({ ...prev, model: '' }));
              }}
              disabled={createAgentMutation.isPending || models.length === 0}
            >
              {!model && <option value="">{labels.requiredModel}</option>}
              {models.map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
            </Select>
            {modelListQuery.isLoading && <div className="muted" style={{ marginTop: 4 }}>{labels.loadingModels}</div>}
            {modelListQuery.isError && (
              <div className="muted" style={{ color: 'var(--danger)', marginTop: 4 }}>
                {labels.loadModelsFailed}
              </div>
            )}
            {!modelListQuery.isLoading && models.length === 0 && (
              <div className="muted" style={{ color: 'var(--warning)', marginTop: 4 }}>
                {labels.noModels}
              </div>
            )}
            {errors.model && (
              <div className="muted" style={{ color: 'var(--danger)', marginTop: 4 }}>
                {errors.model}
              </div>
            )}
          </label>
        </div>

        {agentListQuery.isError && (
          <div className="muted" style={{ color: 'var(--danger)', marginTop: 12 }}>
            {labels.loadAgentsFailed}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Button
            onClick={handleSubmit}
            disabled={createAgentMutation.isPending || models.length === 0}
          >
            {labels.create}
          </Button>
          <Button className="secondary" onClick={() => navigate('/')} disabled={createAgentMutation.isPending}>
            {labels.cancel}
          </Button>
        </div>
      </Card>

      <Card>
        <h3>{labels.details}</h3>
        <div className="form-row">
          {STEP_ORDER.map((step) => (
            <div key={step} className="agent-create-step-row">
              <span>{labels.stepLabels[step]}</span>
              <span className={`agent-create-step-status ${stepStatus[step]}`}>
                {labels.statusLabels[stepStatus[step]]}
              </span>
            </div>
          ))}
        </div>
        {currentStep && createAgentMutation.isPending && (
          <div className="muted" style={{ marginTop: 10 }}>
            {labels.stepLabels[currentStep]}
          </div>
        )}
        {submitSuccess && (
          <div className="muted" style={{ marginTop: 10, color: '#16a34a' }}>
            {submitSuccess}
          </div>
        )}
        {submitError && (
          <div className="muted" style={{ marginTop: 10, color: 'var(--danger)' }}>
            {submitError}
          </div>
        )}
        {stepResults.length > 0 && (
          <div className="form-row" style={{ marginTop: 12 }}>
            {stepResults.map((step) => (
              <div key={step.step} className="agent-create-step-output">
                <div><strong>{labels.stepLabels[step.step]}</strong></div>
                {step.error && <div className="muted" style={{ color: 'var(--danger)' }}>{step.error}</div>}
                {step.stderr && <pre>{step.stderr}</pre>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
