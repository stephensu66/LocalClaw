import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { Components } from 'react-markdown';
import { Button } from '../components/Button';
import { useCreateTask, useTask } from '../hooks/useTasks';
import { api, getEventSource } from '../api/client';
import { useI18n } from '../i18n';
import type { OpenClawSessionEvent } from '@openclaw/shared';
import { useAgentStore } from '../stores/agentStore';
import { useAgentList, useAgentModel, useAgentModelList, useSetAgentModel } from '../hooks/useAgent';

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

interface PendingAttachment {
  id: string;
  file: File;
  kind: 'image' | 'video';
  previewUrl: string;
}

type RenderMessage = {
  id: string;
  type: 'user' | 'assistant' | 'tool' | 'tool_output' | 'compaction' | 'system';
  text: string;
  timestamp?: string | number;
  meta?: Record<string, any>;
};

const markdownComponents: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

const MarkdownText = ({ text }: { text: string }) => (
  <div className="markdown-body">
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  </div>
);

const parseJsonObject = (text: string): Record<string, unknown> | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
};

const toJsonCodeBlock = (value: Record<string, unknown>) => {
  const formatted = JSON.stringify(value, null, 2);
  return `\`\`\`json\n${formatted}\n\`\`\``;
};

const toEpochMs = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const getEventTimestamp = (record: OpenClawSessionEvent): number => {
  const direct = toEpochMs(record.timestamp);
  if (direct > 0) return direct;
  return toEpochMs((record as any)?.message?.timestamp);
};


type UISession = {
  sessionKey?: string;
  sessionId: string;
  sessionFile?: string;
  title?: string;
  updatedAt?: number;
  [key: string]: any;
};

const STORAGE_KEY = 'openclaw_chat_messages';
const PENDING_MATCH_WINDOW_MS = 2 * 60 * 1000;

const fileSignature = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

const normalizeSessions = (raw: unknown): UISession[] => {
  if (!raw) return [];

  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as any).sessions)
      ? (raw as any).sessions
      : raw;

  if (Array.isArray(list)) {
    const looksLikeSession = (item: any) =>
      item && typeof item === 'object' && ('sessionId' in item || 'sessionFile' in item);

    if (list.every(looksLikeSession)) {
      return list as UISession[];
    }

    return list.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      return Object.values(item)
        .filter((value) => value && typeof value === 'object')
        .map((value) => value as UISession);
    });
  }

  if (typeof list === 'object' && list !== null) {
    return Object.values(list)
      .filter((value) => value && typeof value === 'object')
      .map((value) => value as UISession);
  }

  return [];
};

const toAttachmentKind = (file: File): PendingAttachment['kind'] | null => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
};

export function Chat() {
  const { t, isZh } = useI18n();
  const { selectedAgentName, setSelectedAgentName } = useAgentStore();
  const agentListQuery = useAgentList();
  const modelListQuery = useAgentModelList();
  const setAgentModelMutation = useSetAgentModel();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<UISession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionEvents, setSessionEvents] = useState<OpenClawSessionEvent[]>([]);
  const [pendingMessages, setPendingMessages] = useState<RenderMessage[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isAwaitingAssistant, setIsAwaitingAssistant] = useState(false);
  const [modelNotice, setModelNotice] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(40);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const thinkingTimestampRef = useRef<number | null>(null);
  const awaitingUserTimestampRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const attachmentsRef = useRef<PendingAttachment[]>([]);

  const revokeAttachmentUrls = (items: PendingAttachment[]) => {
    items.forEach((item) => {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // Ignore URL revoke failures and keep chat usable.
      }
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {
          // Ignore URL revoke failures and keep chat usable.
        }
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearAttachments = () => {
    setAttachments((prev) => {
      revokeAttachmentUrls(prev);
      return [];
    });
  };

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      revokeAttachmentUrls(attachmentsRef.current);
    };
  }, []);

  const formatTime = (ts?: string | number) => {
    const value = ts ?? Date.now();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const extractMessageText = (message?: OpenClawSessionEvent['message']) => {
    if (!message) return '';
    const content = message.content;
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return String(content ?? '');
    return content.map((chunk) => ('text' in (chunk ?? {}) ? String((chunk as any).text ?? '') : '')).join('');
  };

  const getRecordKey = (record: OpenClawSessionEvent, fallbackIndex: number) => {
    if (record.id) return `id:${record.id}`;
    if (record.type === 'message') {
      const role = record.message?.role ?? 'unknown';
      const text = extractMessageText(record.message).slice(0, 80);
      const ts = getEventTimestamp(record) || '';
      return `msg:${role}:${ts}:${text}`;
    }
    const ts = record.timestamp ?? '';
    return `evt:${record.type}:${ts}:${fallbackIndex}`;
  };

  const mergeSessionEvents = (prev: OpenClawSessionEvent[], incoming: OpenClawSessionEvent[]) => {
    if (prev.length === 0) return incoming;
    if (incoming.length === 0) return prev;
    const seen = new Set(prev.map((record, index) => getRecordKey(record, index)));
    const next = [...prev];
    let changed = false;
    incoming.forEach((record, index) => {
      const key = getRecordKey(record, index);
      if (!seen.has(key)) {
        seen.add(key);
        next.push(record);
        changed = true;
      }
    });
    return changed ? next : prev;
  };

  const createTask = useCreateTask();
  const task = useTask(taskId ?? undefined);
  const hasLoadedAgents = Boolean(agentListQuery.data && agentListQuery.data.length > 0);
  const agentOptions = hasLoadedAgents ? agentListQuery.data! : [selectedAgentName];
  const isAgentListLoading = agentListQuery.isFetching && !hasLoadedAgents;
  const isAgentReadyForModel = hasLoadedAgents && agentOptions.includes(selectedAgentName);
  const agentModelQuery = useAgentModel(isAgentReadyForModel ? selectedAgentName : null);
  const modelOptions = modelListQuery.data ?? [];
  const currentAgentModel = agentModelQuery.data?.model?.trim() ?? '';
  const selectableModels = useMemo(() => {
    if (!currentAgentModel) return modelOptions;
    if (modelOptions.includes(currentAgentModel)) return modelOptions;
    return [currentAgentModel, ...modelOptions];
  }, [modelOptions, currentAgentModel]);
  const canSelectModel =
    isAgentReadyForModel &&
    selectableModels.length > 0 &&
    !modelListQuery.isLoading &&
    !modelListQuery.isError &&
    !agentModelQuery.isLoading &&
    !agentModelQuery.isError &&
    !setAgentModelMutation.isPending;
  const modelSelectValue = currentAgentModel && selectableModels.includes(currentAgentModel) ? currentAgentModel : '';
  const modelSelectPlaceholder = (() => {
    if (!isAgentReadyForModel) return t('loadingAgents');
    if (modelListQuery.isLoading) return t('loading');
    if (modelListQuery.isError) return t('loadModelsFailed');
    if (selectableModels.length === 0) return t('noAvailableModels');
    if (setAgentModelMutation.isPending) return t('updatingAgentModel');
    if (agentModelQuery.isError) return t('setAgentModelFailed');
    if (agentModelQuery.isLoading) return t('loadingAgentModel');
    return t('notSet');
  })();

  useEffect(() => {
    if (!agentListQuery.data || agentListQuery.data.length === 0) return;
    if (!agentListQuery.data.includes(selectedAgentName)) {
      setSelectedAgentName(agentListQuery.data[0]);
    }
  }, [agentListQuery.data, selectedAgentName, setSelectedAgentName]);

  useEffect(() => {
    setModelNotice(null);
    setModelError(null);
  }, [selectedAgentName]);

  const handleSelectModel = async (nextModel: string) => {
    if (!canSelectModel) return;
    if (nextModel === agentModelQuery.data?.model) {
      return;
    }
    setModelError(null);
    setModelNotice(null);
    try {
      await setAgentModelMutation.mutateAsync({
        agentName: selectedAgentName,
        model: nextModel,
      });
      setModelNotice(`${t('setAgentModelSuccess')}: ${nextModel}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setModelError(`${t('setAgentModelFailed')}: ${message}`);
    }
  };

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  };

  const loadSessions = async () => {
    try {
      const { activeSessionId: active, sessions: rawList } = await api.listSessions(selectedAgentName);
      const list = normalizeSessions(rawList as any);

      console.log('raw sessions:', rawList);
      console.log('normalized sessions:', list);
      console.log('backend active session id:', active);

      setSessions(list);

      let current = list.find((s) => s.sessionId === active);

      if (!current && activeSessionId) {
        current = list.find((s) => s.sessionId === activeSessionId);
      }

      current = current ?? list[0] ?? null;

      setActiveSessionId(current?.sessionId ?? null);
    } catch (error) {
      console.error('Failed to load sessions', error);
      setSessionError(t('loadSessionsFailed'));
    }
  };

  const loadSessionRecords = async (sessionId: string) => {
    try {
      console.log('loading session:', sessionId);
      const { records } = await api.getSession(sessionId, selectedAgentName);
      console.log('session records:', records);
      setSessionEvents((prev) => mergeSessionEvents(prev, records));

      const latestUserTs = records
        .filter((record) => record.type === 'message' && record.message?.role === 'user')
        .reduce((max, record) => Math.max(max, getEventTimestamp(record)), 0);
      const latestAssistantTs = records
        .filter((record) => record.type === 'message' && record.message?.role === 'assistant')
        .reduce((max, record) => Math.max(max, getEventTimestamp(record)), 0);
      const hasUnansweredUser = latestUserTs > latestAssistantTs;
      const awaitingTs = awaitingUserTimestampRef.current ?? 0;
      const hasAssistantAfterAwaitingUser = awaitingTs > 0 && latestAssistantTs >= awaitingTs;
      const shouldAwaitAssistant = awaitingTs > 0 ? !hasAssistantAfterAwaitingUser : hasUnansweredUser;
      setIsAwaitingAssistant(shouldAwaitAssistant);
      if (!shouldAwaitAssistant) {
        awaitingUserTimestampRef.current = null;
      }

      setPendingMessages((prev) => {
        if (prev.length === 0) return prev;
        const userMessages = records
          .filter((record) => record.type === 'message' && record.message?.role === 'user')
          .map((record) => ({
            text: extractMessageText(record.message).trim(),
            timestamp: getEventTimestamp(record),
          }))
          .filter((item) => item.text);

        if (userMessages.length === 0) return prev;

        const normalize = (value: string) => value.trim();
        const next = prev.filter((pending) => {
          if (pending.type !== 'user') return true;
          const pendingText = normalize(pending.text ?? '');
          const pendingTs = Number(new Date(pending.timestamp ?? 0));
          return !userMessages.some((item) => {
            const itemText = normalize(item.text ?? '');
            const textMatches =
              itemText === pendingText || itemText.startsWith(pendingText) || pendingText.startsWith(itemText);
            if (!textMatches) return false;
            const itemTs = Number(item.timestamp ?? 0);
            const timeMatches =
              !Number.isFinite(itemTs) || !Number.isFinite(pendingTs) || Math.abs(itemTs - pendingTs) <= PENDING_MATCH_WINDOW_MS;
            return timeMatches;
          });
        });
        return next.length === prev.length ? prev : next;
      });
      setSessionError(null);
    } catch (error) {
      console.error('Failed to load session records', error);
      setSessionEvents([]);
      setSessionError(t('loadSessionRecordsFailed'));
    }
  };

  useEffect(() => {
    setSessions([]);
    setActiveSessionId(null);
    setSessionEvents([]);
    setPendingMessages([]);
    setSessionError(null);
    void loadSessions();
  }, [selectedAgentName]);

  useEffect(() => {
    if (activeSessionId) {
      if (lastSessionIdRef.current !== activeSessionId) {
        lastSessionIdRef.current = activeSessionId;
        setSessionEvents([]);
        setPendingMessages([]);
        setIsAwaitingAssistant(false);
        awaitingUserTimestampRef.current = null;
      }
      loadSessionRecords(activeSessionId);
    } else {
      lastSessionIdRef.current = null;
      setSessionEvents([]);
      setPendingMessages([]);
      setIsAwaitingAssistant(false);
      awaitingUserTimestampRef.current = null;
    }
  }, [activeSessionId, selectedAgentName]);

  useEffect(() => {
    const source = getEventSource();

    const refreshActiveSession = () => {
      if (!activeSessionId) return;
      void loadSessionRecords(activeSessionId);
    };

    const onSessionUpdated = (event: Event) => {
      if (!activeSessionId) return;
      const messageEvent = event as MessageEvent;
      try {
        const payload = JSON.parse(String(messageEvent.data ?? '{}'));
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : null;
        if (!sessionId || sessionId !== activeSessionId) return;
        void loadSessionRecords(activeSessionId);
      } catch {
        // Ignore malformed event payload and keep UI functional.
      }
    };

    source.addEventListener('session.updated', onSessionUpdated as EventListener);
    source.addEventListener('task.updated', refreshActiveSession as EventListener);
    source.addEventListener('task.log', refreshActiveSession as EventListener);

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.removeEventListener('session.updated', onSessionUpdated as EventListener);
      source.removeEventListener('task.updated', refreshActiveSession as EventListener);
      source.removeEventListener('task.log', refreshActiveSession as EventListener);
      source.close();
    };
  }, [activeSessionId, selectedAgentName]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sessionEvents, pendingMessages, activeSessionId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list)
      .map((file) => {
        const kind = toAttachmentKind(file);
        if (!kind) return null;
        return {
          id: `${fileSignature(file)}:${Math.random().toString(16).slice(2, 8)}`,
          file,
          kind,
          previewUrl: URL.createObjectURL(file),
        } satisfies PendingAttachment;
      })
      .filter((item): item is PendingAttachment => Boolean(item));

    if (incoming.length === 0) return;

    setAttachments((prev) => {
      const existing = new Set(prev.map((item) => fileSignature(item.file)));
      const deduped = incoming.filter((item) => !existing.has(fileSignature(item.file)));
      const dropped = incoming.filter((item) => existing.has(fileSignature(item.file)));
      if (dropped.length > 0) {
        revokeAttachmentUrls(dropped);
      }
      return [...prev, ...deduped];
    });
  };

  const adjustTextareaHeight = () => {
    const txt = textareaRef.current;
    if (!txt) return;
    txt.style.height = 'auto';
    const newHeight = Math.min(txt.scrollHeight, 100);
    txt.style.height = `${newHeight}px`;
    setInputHeight(newHeight);
  };

  const onSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && attachments.length === 0) return;

    const fileHint =
      attachments.length > 0 ? `\n\nFiles: ${attachments.map((item) => item.file.name).join(', ')}` : '';
    const userText = `${trimmedInput}${fileHint}`.trim();
    const optimisticText =
      trimmedInput || `Files: ${attachments.map((item) => item.file.name).join(', ')}`;
    const pendingId = `pending-user-${Date.now()}`;
    const optimisticUserMessage: RenderMessage = {
      id: pendingId,
      type: 'user',
      text: optimisticText,
      timestamp: Date.now(),
    };
    if (activeSessionId) {
      awaitingUserTimestampRef.current = Number(optimisticUserMessage.timestamp ?? Date.now());
      setIsAwaitingAssistant(true);
      setPendingMessages((prev) => [...prev, optimisticUserMessage]);
    }

    try {
      const created = await createTask.mutateAsync({
        input: userText,
        sessionId: activeSessionId,
        agentName: selectedAgentName,
      });
      setTaskId(created.id);

      if (activeSessionId) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        await loadSessionRecords(activeSessionId);
      } else {
        const userMessage: ChatMessage = {
          role: 'user',
          content: optimisticText,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMessage]);

        const agentMessage: ChatMessage = {
          role: 'agent',
          content: t('taskAccepted'),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, agentMessage]);
      }
      clearAttachments();
    } catch (error) {
      console.error('Failed to send message:', error);
      if (activeSessionId) {
        setIsAwaitingAssistant(false);
        awaitingUserTimestampRef.current = null;
        setPendingMessages((prev) => prev.filter((item) => item.id !== pendingId));
      }
      if (!activeSessionId) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'agent',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: Date.now(),
          },
        ]);
      }
    }
  };

  const isBackendThinking =
    createTask.isPending || task.data?.status === 'running' || task.data?.status === 'queued';
  const hasPendingUserMessage = pendingMessages.some((msg) => msg.type === 'user');
  const shouldPollSessionRecords = Boolean(activeSessionId) && (isAwaitingAssistant || isBackendThinking || hasPendingUserMessage);

  useEffect(() => {
    if (!activeSessionId || !shouldPollSessionRecords) return;

    const timer = window.setInterval(() => {
      void loadSessionRecords(activeSessionId);
    }, 4500);
    void loadSessionRecords(activeSessionId);
    return () => window.clearInterval(timer);
  }, [activeSessionId, shouldPollSessionRecords, selectedAgentName]);

  const onSendWithClear = async () => {
    if (!input.trim() && attachments.length === 0) return;
    await onSend();
    setInput('');
    setInputHeight(40);
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  };

  const onNewSession = async () => {
    setMessages([]);
    setTaskId(null);
    clearAttachments();
    setSessionEvents([]);
    setSessionError(null);
    setActiveSessionId(null);
    localStorage.removeItem(STORAGE_KEY);

    try {
      const created = await createTask.mutateAsync({ input: '/new', agentName: selectedAgentName });
      setTaskId(created.id);
      setMessages([{ role: 'agent', content: t('newSessionStarted'), timestamp: Date.now() }]);
      await loadSessions();
    } catch (error) {
      console.error('Failed to create new session:', error);
      setSessionError(t('loadSessionsFailed'));
    }
  };

  const adaptSessionRecord = (record: OpenClawSessionEvent, recordIndex: number): RenderMessage[] => {
    if (record.type === 'compaction') {
      return [
        {
          id: `${record.id ?? `compaction-${record.timestamp ?? recordIndex}`}`,
          type: 'compaction',
          text: (record as any).summary ?? t('compactionSummary'),
          timestamp: record.timestamp,
        },
      ];
    }

    if (record.type === 'message') {
      const msg = record.message;
      const role = msg?.role === 'user' ? 'user' : msg?.role === 'assistant' ? 'assistant' : 'system';
      const chunks = Array.isArray(msg?.content) ? msg.content : [{ type: 'text', text: String(msg?.content ?? '') }];
      const flat: RenderMessage[] = [];
      const baseId = record.id ?? `${record.type}-${record.timestamp ?? recordIndex}`;

      chunks.forEach((chunk, chunkIndex) => {
        if (chunk?.type === 'text') {
          flat.push({
            id: `${baseId}-text-${chunkIndex}`,
            type: role,
            text: chunk.text ?? '',
            timestamp: record.timestamp,
          });
        } else if (chunk?.type === 'toolCall') {
          flat.push({
            id: `${baseId}-toolcall-${chunkIndex}`,
            type: 'tool',
            text: `${chunk.name}(${JSON.stringify(chunk.arguments ?? {})})`,
            timestamp: record.timestamp,
            meta: { tool: chunk },
          });
        } else if (chunk?.type === 'toolResult') {
          const output = chunk.output;
          const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
          flat.push({
            id: `${baseId}-toolresult-${chunkIndex}`,
            type: 'tool_output',
            text,
            timestamp: record.timestamp,
            meta: { toolResult: chunk },
          });
        } else {
          flat.push({
            id: `${baseId}-unknown-${chunkIndex}`,
            type: 'system',
            text: JSON.stringify(chunk),
            timestamp: record.timestamp,
            meta: { chunk },
          });
        }
      });
      return flat;
    }

    if (record.type === 'model_change' || record.type === 'thinking_level_change') {
      return [
        {
          id: `${record.type}-${record.id ?? record.timestamp ?? recordIndex}`,
          type: 'system',
          text: `${record.type} ${JSON.stringify(record)}`,
          timestamp: record.timestamp,
          meta: record,
        },
      ];
    }

    return [
      {
        id: `${record.type}-${record.id ?? record.timestamp ?? recordIndex}`,
        type: 'system',
        text: JSON.stringify(record),
        timestamp: record.timestamp,
      },
    ];
  };

  const sessionMessages = useMemo(() => {
    if (sessionEvents.length === 0) return undefined;
    const list: RenderMessage[] = [];
    sessionEvents.forEach((record, index) => {
      list.push(...adaptSessionRecord(record, index));
    });
    return list.sort((a, b) => {
      const ta = Number(new Date(a.timestamp ?? 0));
      const tb = Number(new Date(b.timestamp ?? 0));
      return ta - tb;
    });
  }, [sessionEvents]);

  const displayedMessages: RenderMessage[] = useMemo(() => {
    const fallbackMessages: RenderMessage[] = messages.map((msg, index) => ({
      id: `fallback-${index}`,
      type: (msg.role === 'user' ? 'user' : 'assistant') as RenderMessage['type'],
      text: msg.content,
      timestamp: msg.timestamp,
    }));
    const base = sessionMessages ?? fallbackMessages;
    if (pendingMessages.length === 0) return base;
    return [...base, ...pendingMessages].sort((a, b) => {
      const ta = Number(new Date(a.timestamp ?? 0));
      const tb = Number(new Date(b.timestamp ?? 0));
      return ta - tb;
    });
  }, [sessionMessages, messages, pendingMessages]);

  const shouldShowThinking = useMemo(() => {
    const baseMessages = displayedMessages;
    if (baseMessages.length === 0) return false;
    if (isAwaitingAssistant) return true;
    if (!hasPendingUserMessage && !isBackendThinking) return false;

    let latestUserTs = 0;
    let latestAssistantTs = 0;

    baseMessages.forEach((msg) => {
      const ts = Number(new Date(msg.timestamp ?? 0));
      if (msg.type === 'user' && ts > latestUserTs) latestUserTs = ts;
      if (msg.type === 'assistant' && ts > latestAssistantTs) latestAssistantTs = ts;
    });

    return latestUserTs > latestAssistantTs;
  }, [hasPendingUserMessage, isBackendThinking, displayedMessages, isAwaitingAssistant]);

  useEffect(() => {
    if (shouldShowThinking) {
      if (!thinkingTimestampRef.current) {
        thinkingTimestampRef.current = Date.now();
      }
    } else {
      thinkingTimestampRef.current = null;
    }
  }, [shouldShowThinking]);

  const renderedMessages: RenderMessage[] = useMemo(() => {
    if (!shouldShowThinking) return displayedMessages;
    const thinkingMessage: RenderMessage = {
      id: 'assistant-thinking',
      type: 'assistant',
      text: t('thinking'),
      timestamp: thinkingTimestampRef.current ?? Date.now(),
      meta: { thinking: true },
    };
    return [...displayedMessages, thinkingMessage];
  }, [displayedMessages, shouldShowThinking, t]);

  const isCollapsibleType = (type: RenderMessage['type']) =>
    type === 'tool' || type === 'tool_output' || type === 'compaction' || type === 'system';

  const getCollapsedLabel = (msg: RenderMessage, isAssistantJson?: boolean) => {
    if (isAssistantJson) {
      return t('jsonResponse');
    }
    if (msg.type === 'tool') {
      return msg.meta?.tool?.name ? `${t('toolCall')}: ${msg.meta.tool.name}` : t('toolCall');
    }
    if (msg.type === 'tool_output') {
      return msg.meta?.toolResult?.toolName ? `${t('toolOutput')}: ${msg.meta.toolResult.toolName}` : t('toolOutput');
    }
    if (msg.type === 'compaction') {
      return t('compactionSummary');
    }
    if (msg.type === 'system') {
      return t('systemMessage');
    }
    return t('message');
  };

  const getCollapsedPreview = (msg: RenderMessage, jsonObject?: Record<string, unknown> | null) => {
    if (jsonObject) {
      const keys = Object.keys(jsonObject);
      if (keys.length === 0) return 'empty object';
      const previewKeys = keys.slice(0, 3).join(', ');
      return keys.length > 3 ? `${previewKeys}…` : previewKeys;
    }
    const text = (msg.text ?? '').trim().replace(/\s+/g, ' ');
    if (!text) return '';
    const max = 60;
    return text.length > max ? `${text.slice(0, max)}…` : text;
  };

  console.log('ui sessions:', sessions);
  console.log('activeSessionId:', activeSessionId);
  console.log('task state:', task);

  return (
    <>
      <style>{`
        @keyframes chat-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes chat-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
        .chat-wrapper button {
          cursor: pointer;
          transition: transform 0.08s ease, filter 0.08s ease;
        }
        .chat-wrapper button:active {
          transform: translateY(1px);
          filter: brightness(0.98);
        }
        .chat-wrapper button:disabled {
          cursor: not-allowed;
          filter: none;
          transform: none;
        }
        .chat-collapse-btn {
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 2px 6px;
          background: transparent;
          color: #6b7280;
          font-size: 12px;
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .chat-collapse-btn:hover {
          border-color: #cbd5f5;
          color: #4f46e5;
          background: #eef2ff;
        }
      `}</style>
      <div className="chat-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f5f7fb' }}>
        <div
          className="chat-header"
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #ddd',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <strong>{t('chatTitle')}</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 8, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#666', fontSize: 12, minWidth: 30 }}>{isZh ? 'Agent' : 'Agent'}</span>
              <select
                value={selectedAgentName}
                onChange={(e) => setSelectedAgentName(e.target.value)}
                disabled={isAgentListLoading}
                style={{ border: '1px solid #ccc', borderRadius: 6, padding: '4px 8px', fontSize: 12, flex: 1 }}
              >
                {isAgentListLoading ? (
                  <option value={selectedAgentName}>{t('loadingAgents')}</option>
                ) : (
                  agentOptions.map((agentName) => (
                    <option key={agentName} value={agentName}>
                      {agentName}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#666', fontSize: 12, minWidth: 30 }}>{isZh ? '会话' : 'Session'}</span>
              <select
                value={activeSessionId || ''}
                onChange={(e) => {
                  const selectedId = e.target.value || null;
                  const selected = sessions.find((s) => s.sessionId === selectedId) ?? null;
                  setActiveSessionId(selected?.sessionId ?? null);
                }}
                style={{ border: '1px solid #ccc', borderRadius: 6, padding: '4px 8px', fontSize: 12, flex: 1 }}
              >
                {sessions.length === 0 && <option value="">{t('noSessions')}</option>}
                {sessions.map((session) => (
                  <option key={session.sessionId} value={session.sessionId}>
                    {session.title ?? session.sessionId}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 300, maxWidth: 360, marginLeft: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#666', fontSize: 12, minWidth: 30 }}>{t('modelSelector')}</span>
              <select
                value={modelSelectValue}
                onChange={(e) => {
                  const nextModel = e.target.value;
                  if (!nextModel) return;
                  void handleSelectModel(nextModel);
                }}
                disabled={!canSelectModel}
                style={{ border: '1px solid #ccc', borderRadius: 6, padding: '4px 8px', fontSize: 12, flex: 1 }}
              >
                {!modelSelectValue && (
                  <option value="">{modelSelectPlaceholder}</option>
                )}
                {selectableModels.map((modelName) => (
                  <option key={modelName} value={modelName}>
                    {modelName}
                  </option>
                ))}
              </select>
            </div>
            {modelError && <div style={{ fontSize: 12, color: '#b91c1c' }}>{modelError}</div>}
            {!modelError && modelNotice && <div style={{ fontSize: 12, color: '#166534' }}>{modelNotice}</div>}
          </div>

          <Button className="secondary" onClick={loadSessions} style={{ fontSize: 12, marginLeft: 4 }}>
            {t('refresh')}
          </Button>
        </div>

        <div className="messages" ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {sessionError && (
            <div style={{ marginBottom: 12, color: '#b91c1c', fontSize: 12 }}>
              {sessionError}
            </div>
          )}

          {renderedMessages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', marginTop: '50px' }}>
              {t('instructionPlaceholder') || t('askAnything')}
            </div>
          ) : (
            renderedMessages.map((msg) => {
              if (msg.type === 'compaction') {
                const collapsed = collapsedMap[msg.id] ?? true;
                return (
                  <div key={msg.id}
                    onClick={() => setCollapsedMap((prev) => ({ ...prev, [msg.id]: !(prev[msg.id] ?? false) }))}
                    className="compaction-block" style={{ textAlign: 'center', color: '#999', margin: '10px 0' }}
                  >
                    {collapsed ? (
                      <button
                        type="button"

                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 10,
                          padding: '6px 10px',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#6b7280',
                        }}
                      >
                        {getCollapsedLabel(msg)}
                        {getCollapsedPreview(msg) ? ` · ${getCollapsedPreview(msg)}` : ''}
                      </button>
                    ) : (
                      <div
                        style={{
                          display: 'inline-block',
                          textAlign: 'left',
                          maxWidth: '70%',
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 12,
                          padding: '10px 12px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                      >
                        <MarkdownText text={msg.text} />
                        <div style={{ marginTop: 8, textAlign: 'right' }}>
                          <button
                            type="button"
                            className="chat-collapse-btn"
                            onClick={() => setCollapsedMap((prev) => ({ ...prev, [msg.id]: !(prev[msg.id] ?? true) }))}
                          >
                            {t('collapse')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              const isUser = msg.type === 'user';
              const isTool = msg.type === 'tool' || msg.type === 'tool_output';
              const isSystem = msg.type === 'system';
              const assistantJson = msg.type === 'assistant' ? parseJsonObject(msg.text) : null;
              const isAssistantJson = Boolean(assistantJson);
              const isThinking = Boolean(msg.meta?.thinking);
              const isCollapsible = (isCollapsibleType(msg.type) || isAssistantJson) && !isThinking;
              const collapsed = isCollapsible ? (collapsedMap[msg.id] ?? true) : false;
              const shouldRenderMarkdown =
                msg.type === 'assistant' ||
                msg.type === 'tool' ||
                msg.type === 'tool_output' ||
                msg.type === 'system';
              const shouldRenderThinking = isThinking && msg.type === 'assistant';
              const showExpandedMeta = !isCollapsible || !collapsed;
              const align = isUser ? 'flex-end' : 'flex-start';
              const background = isUser ? '#0d77ff' : isTool ? '#f3f4f6' : '#fff';
              const color = isUser ? '#fff' : '#111';
              const label = isUser ? t('youLabel') : isTool ? t('toolLabel') : isSystem ? t('systemLabel') : t('assistantLabel');
              const avatarText = label.slice(0, 1);
              const avatarBg = isUser ? '#fee2e2' : isTool ? '#e5e7eb' : '#e0f2fe';
              const avatarColor = isUser ? '#b91c1c' : isTool ? '#4b5563' : '#0f172a';

              return (
                <div key={msg.id} style={{ marginBottom: '12px', display: 'flex', justifyContent: align }}>
                  <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end', maxWidth: '100%' }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: avatarBg,
                        color: avatarColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        border: '1px solid #e5e7eb',
                        flexShrink: 0,
                      }}
                    >
                      {avatarText}
                    </div>
                    <div style={{ maxWidth: '70%' }}>
                      <div
                        className="bubble"
                        style={{
                          padding: '12px 16px',
                          borderRadius: 14,
                          background,
                          color,
                          whiteSpace: shouldRenderMarkdown ? 'normal' : 'pre-wrap',
                          wordBreak: 'break-word',
                          border: isTool ? '1px solid #e2e8f0' : 'none',
                          boxShadow: isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
                        }}
                      >
                        {isCollapsible && collapsed ? (
                          <button
                            type="button"
                            onClick={() => setCollapsedMap((prev) => ({ ...prev, [msg.id]: !(prev[msg.id] ?? true) }))}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              border: 'none',
                              padding: 0,
                              background: 'transparent',
                              color: '#4b5563',
                              cursor: 'pointer',
                            }}
                          >
                            <strong style={{ fontWeight: 600 }}>{getCollapsedLabel(msg, isAssistantJson)}</strong>
                            {getCollapsedPreview(msg, assistantJson) ? ` · ${getCollapsedPreview(msg, assistantJson)}` : ''}
                          </button>
                        ) : (
                          <>
                            {shouldRenderThinking ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    border: '2px solid #cbd5f5',
                                    borderTopColor: '#4f46e5',
                                    animation: 'chat-spin 0.9s linear infinite',
                                    display: 'inline-block',
                                  }}
                                />
                                <span style={{ fontSize: 14, color: '#475569', animation: 'chat-pulse 1.2s ease-in-out infinite' }}>
                                  {t('thinking')}
                                </span>
                              </div>
                            ) : shouldRenderMarkdown ? (
                              <MarkdownText text={isAssistantJson ? toJsonCodeBlock(assistantJson ?? {}) : msg.text} />
                            ) : (
                              msg.text
                            )}
                            {isCollapsible && (
                              <div style={{ marginTop: 8 }}>
                                <button
                                  type="button"
                                  className="chat-collapse-btn"
                                  onClick={() => setCollapsedMap((prev) => ({ ...prev, [msg.id]: !(prev[msg.id] ?? true) }))}
                                >
                                  {t('collapse')}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        {showExpandedMeta && msg.meta?.tool && (
                          <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
                            {t('toolLabel')}: {String(msg.meta?.tool?.name ?? '')}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: '#8b8b8b',
                          display: 'flex',
                          gap: 8,
                          justifyContent: isUser ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{label}</span>
                        <span>{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bottom-input-wrapper" style={{ borderTop: '1px solid #ddd', background: '#fff' }}>
          <div className="input-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', padding: '8px 12px' }}>
            <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: 10, padding: 8, background: '#fff' }}>
              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {attachments.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        background: '#f8fafc',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {item.kind === 'image' ? (
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <video
                          src={item.previewUrl}
                          muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(item.id)}
                        aria-label="remove attachment"
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: 'none',
                          background: 'rgba(17,24,39,0.75)',
                          color: '#fff',
                          fontSize: 12,
                          lineHeight: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSendWithClear();
                  }
                }}
                placeholder={t('instructionPlaceholder') || t('typeYourMessage')}
                style={{
                  width: '100%',
                  minHeight: 40,
                  maxHeight: 100,
                  height: inputHeight,
                  overflowY: inputHeight >= 100 ? 'auto' : 'hidden',
                  border: 'none',
                  outline: 'none',
                  padding: '6px 4px',
                  fontSize: 14,
                  resize: 'none',
                  transition: 'height 0.1s ease',
                  background: 'transparent',
                }}
              />
            </div>
            <Button
              onClick={onSendWithClear}
              disabled={(!input.trim() && attachments.length === 0) || createTask.isPending}
              style={{ whiteSpace: 'nowrap' }}
            >
              {t('send') || 'Send'}
            </Button>
          </div>

          <div className="toolbar-row" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8, padding: '4px 12px 8px' }}>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept="image/*,video/*"
              multiple
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ border: '1px solid #ccc', borderRadius: 8, background: '#fff', padding: '6px 10px', cursor: 'pointer' }}
            >
              📎 {t('attachment')}
            </button>
            <Button
              className="secondary"
              onClick={onNewSession}
              style={{ borderRadius: 8, padding: '6px 10px' }}
            >
              {t('newSession')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
