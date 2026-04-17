import { constants as fsConstants } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { runCommand } from '../../openclaw/cli';
import {
  ensureOpenClawInstalled,
  readGatewayToken,
  runNonInteractiveOnboarding,
  startGateway,
} from '../../openclaw/installer';
import type { SettingsService } from '../../services/settingsService';
import type { OpenClawAdapter } from '../../openclaw/adapter';

type SetupConsent = {
  nodeInstall: boolean;
  openclawInstall: boolean;
};

type SetupPaths = {
  openclawInstallDir: string | null;
  workDir: string | null;
};

type SetupRunStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export interface SetupStepResult {
  id: string;
  status: 'succeeded' | 'skipped' | 'failed';
  message: string;
}

export interface SetupRunStep extends SetupStepResult {
  at: string;
}

export interface SetupRunState {
  runId: string | null;
  status: SetupRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  currentStepId: string | null;
  error: string | null;
  resumable: boolean;
  steps: SetupRunStep[];
}

type SetupState = {
  consent: SetupConsent;
  paths: SetupPaths;
  run: SetupRunState;
};

type VersionCheck = {
  installed: boolean;
  version: string | null;
  major: number | null;
};

type OpenClawCheck = {
  installed: boolean;
  version: string | null;
  meetsMinVersion: boolean;
  minVersion: string | null;
};

export interface SetupPathCheck {
  id: keyof SetupPaths;
  path: string | null;
  exists: boolean | null;
  writable: boolean | null;
  freeBytes: number | null;
  requiredFreeBytes: number;
  hasEnoughSpace: boolean | null;
  ok: boolean;
  message: string;
}

export interface SetupPrecheckView {
  ok: boolean;
  minFreeGb: number;
  checks: SetupPathCheck[];
}

export interface SetupStatusView {
  checkedAt: string;
  mode: 'mock' | 'real';
  ready: boolean;
  node: VersionCheck & {
    requiredMajor: number;
    satisfies: boolean;
  };
  openclaw: OpenClawCheck;
  gateway: {
    tokenFound: boolean;
    gatewayCommandConfigured: boolean;
    onboardingCommandConfigured: boolean;
  };
  consent: SetupConsent;
  paths: SetupPaths;
  precheck: SetupPrecheckView;
  run: SetupRunState;
}

export interface SetupRunResult {
  ok: boolean;
  steps: SetupStepResult[];
  status: SetupStatusView;
}

export interface SetupUpdateInput {
  consent?: Partial<SetupConsent>;
  paths?: Partial<SetupPaths>;
}

type StepRecorder = (step: SetupStepResult) => Promise<void>;

const RUN_STATUSES = new Set<SetupRunStatus>(['idle', 'running', 'succeeded', 'failed']);
const STEP_STATUSES = new Set<SetupStepResult['status']>(['succeeded', 'skipped', 'failed']);
const BYTES_PER_GB = 1024 * 1024 * 1024;

function createDefaultRunState(): SetupRunState {
  return {
    runId: null,
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    currentStepId: null,
    error: null,
    resumable: false,
    steps: [],
  };
}

const DEFAULT_STATE: SetupState = {
  consent: {
    nodeInstall: false,
    openclawInstall: false,
  },
  paths: {
    openclawInstallDir: null,
    workDir: null,
  },
  run: createDefaultRunState(),
};

function normalizeDir(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return path.resolve(trimmed);
}

function parseSemver(input: string): number[] | null {
  const match = input.trim().match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: string, b: string): number | null {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function parseNodeVersion(output: string): VersionCheck {
  const firstLine = output
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return { installed: false, version: null, major: null };
  }
  const semver = parseSemver(firstLine);
  return {
    installed: Boolean(semver),
    version: semver ? `v${semver.join('.')}` : firstLine,
    major: semver ? semver[0] : null,
  };
}

function parseOpenClawVersion(output: string): string | null {
  const firstLine = output
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return null;
  const semver = parseSemver(firstLine);
  if (!semver) return null;
  return `v${semver.join('.')}`;
}

function normalizeRunStatus(value: unknown): SetupRunStatus {
  if (typeof value === 'string' && RUN_STATUSES.has(value as SetupRunStatus)) {
    return value as SetupRunStatus;
  }
  return 'idle';
}

function normalizeStepStatus(value: unknown): SetupStepResult['status'] | null {
  if (typeof value === 'string' && STEP_STATUSES.has(value as SetupStepResult['status'])) {
    return value as SetupStepResult['status'];
  }
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') {
    const casted = Number(value);
    return Number.isFinite(casted) ? casted : null;
  }
  return null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown setup error';
}

export class SetupService {
  private statePath = path.join(env.appDataDir, 'setup-state.json');
  private activeRunId: string | null = null;

  constructor(
    private settingsService: SettingsService,
    private adapter: OpenClawAdapter
  ) {}

  private normalizeRunState(raw?: Partial<SetupRunState> | null): SetupRunState {
    const status = normalizeRunStatus(raw?.status);
    const rawSteps = Array.isArray(raw?.steps) ? raw.steps : [];
    const steps: SetupRunStep[] = rawSteps
      .map((entry) => {
        const statusValue = normalizeStepStatus((entry as SetupRunStep | undefined)?.status);
        const id = typeof (entry as SetupRunStep | undefined)?.id === 'string' ? (entry as SetupRunStep).id.trim() : '';
        const message =
          typeof (entry as SetupRunStep | undefined)?.message === 'string'
            ? (entry as SetupRunStep).message
            : '';
        const at =
          typeof (entry as SetupRunStep | undefined)?.at === 'string' && (entry as SetupRunStep).at.trim()
            ? (entry as SetupRunStep).at
            : new Date(0).toISOString();
        if (!id || !statusValue || !message) return null;
        return {
          id,
          status: statusValue,
          message,
          at,
        };
      })
      .filter((entry): entry is SetupRunStep => Boolean(entry));

    return {
      runId: typeof raw?.runId === 'string' && raw.runId.trim() ? raw.runId : null,
      status,
      startedAt: typeof raw?.startedAt === 'string' ? raw.startedAt : null,
      finishedAt: typeof raw?.finishedAt === 'string' ? raw.finishedAt : null,
      currentStepId: typeof raw?.currentStepId === 'string' ? raw.currentStepId : null,
      error: typeof raw?.error === 'string' ? raw.error : null,
      resumable: status === 'failed' ? true : Boolean(raw?.resumable),
      steps,
    };
  }

  private async loadState(): Promise<SetupState> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SetupState>;
      return {
        consent: {
          nodeInstall: Boolean(parsed?.consent?.nodeInstall),
          openclawInstall: Boolean(parsed?.consent?.openclawInstall),
        },
        paths: {
          openclawInstallDir: normalizeDir(parsed?.paths?.openclawInstallDir),
          workDir: normalizeDir(parsed?.paths?.workDir),
        },
        run: this.normalizeRunState(parsed?.run),
      };
    } catch {
      return {
        consent: { ...DEFAULT_STATE.consent },
        paths: { ...DEFAULT_STATE.paths },
        run: createDefaultRunState(),
      };
    }
  }

  private async saveState(next: SetupState): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    await fs.writeFile(`${this.statePath}.tmp`, JSON.stringify(next, null, 2), 'utf8');
    await fs.rename(`${this.statePath}.tmp`, this.statePath);
  }

  private mergeState(current: SetupState, input?: SetupUpdateInput): SetupState {
    return {
      consent: {
        nodeInstall: input?.consent?.nodeInstall ?? current.consent.nodeInstall,
        openclawInstall: input?.consent?.openclawInstall ?? current.consent.openclawInstall,
      },
      paths: {
        openclawInstallDir: normalizeDir(
          input?.paths?.openclawInstallDir ?? current.paths.openclawInstallDir
        ),
        workDir: normalizeDir(input?.paths?.workDir ?? current.paths.workDir),
      },
      run: current.run,
    };
  }

  private async pathExists(target: string): Promise<boolean> {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private async resolveExistingAncestor(target: string): Promise<string | null> {
    let cursor = path.resolve(target);
    while (true) {
      if (await this.pathExists(cursor)) return cursor;
      const parent = path.dirname(cursor);
      if (parent === cursor) return null;
      cursor = parent;
    }
  }

  private async readFreeBytes(target: string): Promise<number | null> {
    try {
      const stat = await fs.statfs(target);
      const bavail = toFiniteNumber((stat as unknown as { bavail?: number | bigint }).bavail);
      const bsize = toFiniteNumber((stat as unknown as { bsize?: number | bigint }).bsize);
      if (bavail == null || bsize == null) return null;
      return Math.max(0, Math.floor(bavail * bsize));
    } catch {
      return null;
    }
  }

  private async checkPath(id: keyof SetupPaths, rawDir: string | null): Promise<SetupPathCheck> {
    const requiredFreeBytes = env.setupMinFreeGb * BYTES_PER_GB;
    if (!rawDir) {
      return {
        id,
        path: null,
        exists: null,
        writable: null,
        freeBytes: null,
        requiredFreeBytes,
        hasEnoughSpace: null,
        ok: true,
        message: 'Not set. Default path strategy will be used.',
      };
    }

    const dir = path.resolve(rawDir);
    const exists = await this.pathExists(dir);
    const writableTarget = exists ? dir : path.dirname(dir);
    const writableBase = await this.resolveExistingAncestor(writableTarget);
    let writable = false;
    if (writableBase) {
      try {
        await fs.access(writableBase, fsConstants.W_OK);
        writable = true;
      } catch {
        writable = false;
      }
    }

    const statBase = await this.resolveExistingAncestor(exists ? dir : path.dirname(dir));
    const freeBytes = statBase ? await this.readFreeBytes(statBase) : null;
    const hasEnoughSpace = freeBytes == null ? null : freeBytes >= requiredFreeBytes;

    const ok = writable && hasEnoughSpace !== false;
    let message = 'Directory check passed.';
    if (!exists) {
      message = 'Directory does not exist yet. Parent path will be used for permission and space checks.';
    }
    if (!writable) {
      message = 'Directory or its parent path is not writable.';
    } else if (hasEnoughSpace === false) {
      message = `Not enough free disk space. Require at least ${env.setupMinFreeGb} GB.`;
    } else if (hasEnoughSpace == null) {
      message = 'Writable, but free-space check is unavailable on this platform.';
    }

    return {
      id,
      path: dir,
      exists,
      writable,
      freeBytes,
      requiredFreeBytes,
      hasEnoughSpace,
      ok,
      message,
    };
  }

  private async buildPrecheck(paths: SetupPaths): Promise<SetupPrecheckView> {
    const checks = await Promise.all([
      this.checkPath('openclawInstallDir', paths.openclawInstallDir),
      this.checkPath('workDir', paths.workDir),
    ]);
    return {
      ok: checks.every((check) => check.ok),
      minFreeGb: env.setupMinFreeGb,
      checks,
    };
  }

  private async recoverStaleRun(state: SetupState): Promise<SetupState> {
    if (state.run.status !== 'running') return state;
    if (!state.run.runId) return state;
    if (state.run.runId === this.activeRunId) return state;

    const next: SetupState = {
      ...state,
      run: {
        ...state.run,
        status: 'failed',
        error: state.run.error ?? 'Previous setup run was interrupted before completion.',
        resumable: true,
        finishedAt: state.run.finishedAt ?? new Date().toISOString(),
      },
    };
    await this.saveState(next);
    return next;
  }

  private async startRun(state: SetupState): Promise<SetupState> {
    const runId = randomUUID();
    const next: SetupState = {
      ...state,
      run: {
        runId,
        status: 'running',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        currentStepId: null,
        error: null,
        resumable: false,
        steps: [],
      },
    };
    this.activeRunId = runId;
    await this.saveState(next);
    return next;
  }

  private async appendRunStep(state: SetupState, step: SetupStepResult): Promise<SetupState> {
    if (state.run.status !== 'running') return state;
    const next: SetupState = {
      ...state,
      run: {
        ...state.run,
        currentStepId: step.id,
        steps: [
          ...state.run.steps,
          {
            ...step,
            at: new Date().toISOString(),
          },
        ],
      },
    };
    await this.saveState(next);
    return next;
  }

  private async finishRun(
    state: SetupState,
    status: Extract<SetupRunStatus, 'succeeded' | 'failed'>,
    error: string | null
  ): Promise<SetupState> {
    const next: SetupState = {
      ...state,
      run: {
        ...state.run,
        status,
        error,
        resumable: status === 'failed',
        finishedAt: new Date().toISOString(),
      },
    };
    this.activeRunId = null;
    await this.saveState(next);
    return next;
  }

  private async checkNode(): Promise<VersionCheck> {
    const result = await runCommand('node --version');
    if (result.code !== 0) {
      return { installed: false, version: null, major: null };
    }
    return parseNodeVersion(result.stdout || result.stderr);
  }

  private async checkOpenClaw(): Promise<OpenClawCheck> {
    const result = await runCommand(`${env.openclawBinary} --version`);
    if (result.code !== 0) {
      return {
        installed: false,
        version: null,
        meetsMinVersion: false,
        minVersion: env.openclawMinVersion ?? null,
      };
    }
    const version = parseOpenClawVersion(result.stdout || result.stderr);
    const minVersion = env.openclawMinVersion ?? null;
    const meetsMinVersion = !minVersion || (version ? (compareSemver(version, minVersion) ?? -1) >= 0 : false);
    return {
      installed: Boolean(version),
      version,
      meetsMinVersion,
      minVersion,
    };
  }

  async getStatus(): Promise<SetupStatusView> {
    const checkedAt = new Date().toISOString();
    let state = await this.loadState();
    state = await this.recoverStaleRun(state);
    const [node, openclaw, precheck] = await Promise.all([
      this.checkNode(),
      this.checkOpenClaw(),
      this.buildPrecheck(state.paths),
    ]);
    const requiredMajor = env.nodeRequiredMajor;
    const nodeSatisfies = node.installed && node.major === requiredMajor;
    const tokenFound = Boolean(readGatewayToken());
    const ready =
      env.openclawMode === 'real' &&
      nodeSatisfies &&
      openclaw.installed &&
      openclaw.meetsMinVersion &&
      precheck.ok;

    return {
      checkedAt,
      mode: env.openclawMode,
      ready,
      node: {
        ...node,
        requiredMajor,
        satisfies: nodeSatisfies,
      },
      openclaw,
      gateway: {
        tokenFound,
        gatewayCommandConfigured: Boolean(env.openclawGatewayCmd?.trim()),
        onboardingCommandConfigured: Boolean(env.openclawOnboardCmd?.trim()),
      },
      consent: state.consent,
      paths: state.paths,
      precheck,
      run: state.run,
    };
  }

  async updateState(input: SetupUpdateInput): Promise<SetupStatusView> {
    let current = await this.loadState();
    current = await this.recoverStaleRun(current);
    const next = this.mergeState(current, input);
    await this.saveState(next);
    return this.getStatus();
  }

  private async installNode(consented: boolean, recordStep: StepRecorder): Promise<void> {
    const checkBefore = await this.checkNode();
    const requiredMajor = env.nodeRequiredMajor;
    if (checkBefore.installed && checkBefore.major === requiredMajor) {
      await recordStep({
        id: 'node',
        status: 'skipped',
        message: `Node ${checkBefore.version} already satisfies required major ${requiredMajor}`,
      });
      return;
    }

    if (!consented) {
      await recordStep({
        id: 'consent_node',
        status: 'failed',
        message: 'Node installation consent is required when Node check fails',
      });
      throw new Error('Missing node consent');
    }

    if (!env.nodeInstallCmd) {
      await recordStep({
        id: 'node',
        status: 'failed',
        message: `Node ${requiredMajor} is required but NODE_INSTALL_CMD is not configured`,
      });
      throw new Error('NODE_INSTALL_CMD missing');
    }

    const installResult = await runCommand(env.nodeInstallCmd);
    if (installResult.code !== 0) {
      await recordStep({
        id: 'node',
        status: 'failed',
        message: `Node installation failed: ${installResult.stderr || installResult.stdout || 'unknown error'}`,
      });
      throw new Error('Node installation failed');
    }

    const checkAfter = await this.checkNode();
    if (!checkAfter.installed || checkAfter.major !== requiredMajor) {
      await recordStep({
        id: 'node',
        status: 'failed',
        message: `Node installation completed but required major ${requiredMajor} not detected`,
      });
      throw new Error('Node version still unsatisfied');
    }

    await recordStep({
      id: 'node',
      status: 'succeeded',
      message: `Node ready: ${checkAfter.version}`,
    });
  }

  private async installOpenClaw(
    state: SetupState,
    consented: boolean,
    recordStep: StepRecorder
  ): Promise<void> {
    const checkBefore = await this.checkOpenClaw();
    const needsInstall = !checkBefore.installed || !checkBefore.meetsMinVersion;
    if (!needsInstall) {
      await recordStep({
        id: 'openclaw',
        status: 'skipped',
        message: `OpenClaw ready: ${checkBefore.version}`,
      });
      return;
    }

    if (!consented) {
      await recordStep({
        id: 'consent_openclaw',
        status: 'failed',
        message: 'OpenClaw installation consent is required when OpenClaw check fails',
      });
      throw new Error('Missing openclaw consent');
    }

    const installDir = state.paths.openclawInstallDir;
    if (installDir && !env.openclawInstallCmd) {
      await recordStep({
        id: 'openclaw',
        status: 'failed',
        message: 'Custom install directory requires OPENCLAW_INSTALL_CMD with {installDir}',
      });
      throw new Error('OPENCLAW_INSTALL_CMD missing for custom installDir');
    }

    if (env.openclawInstallCmd) {
      const command = env.openclawInstallCmd.replace(/\{installDir\}/g, installDir ?? '');
      const installResult = await runCommand(command);
      if (installResult.code !== 0) {
        await recordStep({
          id: 'openclaw',
          status: 'failed',
          message: `OpenClaw installation failed: ${installResult.stderr || installResult.stdout || 'unknown error'}`,
        });
        throw new Error('OpenClaw installation failed');
      }
    } else {
      await ensureOpenClawInstalled({
        binaryName: env.openclawBinary,
        installScriptSh: env.openclawInstallSh,
        installScriptPs: env.openclawInstallPs,
      });
    }

    const checkAfter = await this.checkOpenClaw();
    if (!checkAfter.installed || !checkAfter.meetsMinVersion) {
      await recordStep({
        id: 'openclaw',
        status: 'failed',
        message: checkAfter.installed
          ? `OpenClaw ${checkAfter.version} does not satisfy minimum ${checkAfter.minVersion}`
          : 'OpenClaw not detected after installation',
      });
      throw new Error('OpenClaw still unavailable');
    }

    await recordStep({
      id: 'openclaw',
      status: 'succeeded',
      message: `OpenClaw ready: ${checkAfter.version}`,
    });
  }

  private async setupGateway(recordStep: StepRecorder): Promise<void> {
    const token = readGatewayToken();
    if (token) {
      process.env.OPENCLAW_GATEWAY_TOKEN = token;
      await recordStep({
        id: 'gateway_token',
        status: 'succeeded',
        message: 'Gateway token loaded from local config',
      });
    } else if (env.openclawOnboardCmd) {
      await runNonInteractiveOnboarding(env.openclawOnboardCmd);
      await recordStep({
        id: 'onboarding',
        status: 'succeeded',
        message: 'Non-interactive onboarding executed',
      });
    } else {
      await recordStep({
        id: 'onboarding',
        status: 'skipped',
        message: 'No gateway token found and OPENCLAW_ONBOARD_CMD is not configured',
      });
    }

    if (env.openclawGatewayCmd) {
      await startGateway(env.openclawGatewayCmd);
      await recordStep({
        id: 'gateway_start',
        status: 'succeeded',
        message: 'Gateway start command executed',
      });
    } else {
      await recordStep({
        id: 'gateway_start',
        status: 'skipped',
        message: 'OPENCLAW_GATEWAY_CMD is not configured',
      });
    }
  }

  async run(input?: SetupUpdateInput): Promise<SetupRunResult> {
    let current = await this.loadState();
    current = await this.recoverStaleRun(current);
    let state = this.mergeState(current, input);
    await this.saveState(state);
    state = await this.startRun(state);

    const steps: SetupStepResult[] = [];
    const recordStep: StepRecorder = async (step) => {
      steps.push(step);
      state = await this.appendRunStep(state, step);
    };

    let previousWorkDir: { workDirAuto: boolean; workDir: string } | null = null;
    let workDirChanged = false;

    try {
      if (env.openclawMode !== 'real') {
        await recordStep({
          id: 'mode',
          status: 'failed',
          message: `OPENCLAW_MODE=${env.openclawMode}. Set OPENCLAW_MODE=real for setup automation.`,
        });
        throw new Error('OPENCLAW_MODE is not real');
      }

      const precheck = await this.buildPrecheck(state.paths);
      if (!precheck.ok) {
        const failedReasons = precheck.checks
          .filter((entry) => !entry.ok)
          .map((entry) => `${entry.id}: ${entry.message}`)
          .join('; ');
        await recordStep({
          id: 'precheck',
          status: 'failed',
          message: failedReasons || 'Precheck failed',
        });
        throw new Error('Setup precheck failed');
      }

      await recordStep({
        id: 'precheck',
        status: 'succeeded',
        message: `Precheck passed. Minimum free disk requirement: ${env.setupMinFreeGb} GB`,
      });

      await this.installNode(state.consent.nodeInstall, recordStep);
      await this.installOpenClaw(state, state.consent.openclawInstall, recordStep);

      if (state.paths.workDir) {
        const currentSettings = await this.settingsService.getInternal();
        previousWorkDir = {
          workDirAuto: currentSettings.workDirAuto,
          workDir: currentSettings.workDir,
        };
        await this.settingsService.update({
          workDirAuto: false,
          workDir: state.paths.workDir,
        });
        workDirChanged = true;
        await recordStep({
          id: 'workdir',
          status: 'succeeded',
          message: `Work directory set: ${state.paths.workDir}`,
        });
      } else {
        await recordStep({
          id: 'workdir',
          status: 'skipped',
          message: 'Using default work directory',
        });
      }

      await this.setupGateway(recordStep);

      const internal = await this.settingsService.getInternal();
      await this.adapter.syncLocalConfig(internal);
      await recordStep({
        id: 'sync_config',
        status: 'succeeded',
        message: 'Local configuration synchronized to OpenClaw',
      });

      state = await this.finishRun(state, 'succeeded', null);
      const status = await this.getStatus();
      return {
        ok: status.ready,
        steps,
        status,
      };
    } catch (error) {
      if (workDirChanged && previousWorkDir) {
        try {
          await this.settingsService.update(previousWorkDir);
          await recordStep({
            id: 'rollback_workdir',
            status: 'succeeded',
            message: `Work directory rolled back to ${previousWorkDir.workDir}`,
          });
        } catch (rollbackError) {
          await recordStep({
            id: 'rollback_workdir',
            status: 'failed',
            message: `Work directory rollback failed: ${errorMessage(rollbackError)}`,
          });
        }
      }

      state = await this.finishRun(state, 'failed', errorMessage(error));
      const status = await this.getStatus();
      return {
        ok: false,
        steps,
        status,
      };
    }
  }
}
