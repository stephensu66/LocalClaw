import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AgentCreatePayload, AgentModelSetPayload } from '../api/client';

export function useAgentStatus() {
  return useQuery({
    queryKey: ['agent-status'],
    queryFn: () => api.getAgentStatus(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
}

export function useEnvCheck() {
  return useMutation({
    mutationFn: () => api.envCheck(),
  });
}

export function useAgentList() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await api.listAgents();
      return response.agents ?? [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useAgentModelList() {
  return useQuery({
    queryKey: ['agent-models'],
    queryFn: async () => {
      const response = await api.listAgentModels();
      return response.models;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAgentModel(agentName?: string | null) {
  return useQuery({
    queryKey: ['agent-model', agentName ?? ''],
    queryFn: async () => {
      if (!agentName) {
        return { agentName: '', agentIndex: -1, model: null };
      }
      return api.getAgentModel(agentName);
    },
    enabled: Boolean(agentName),
  });
}

export function useAgentWorkspace(agentName?: string | null) {
  return useQuery({
    queryKey: ['agent-workspace', agentName ?? ''],
    queryFn: async () => {
      if (!agentName) {
        return { agentName: '', agentIndex: -1, workspace: '', defaultWorkspace: null };
      }
      return api.getAgentWorkspace(agentName);
    },
    enabled: Boolean(agentName),
  });
}

export function useSetAgentModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentModelSetPayload) => api.setAgentModel(input),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(['agent-model', variables.agentName], {
        agentName: result.agentName,
        agentIndex: result.agentIndex,
        model: result.model,
      });
      queryClient.invalidateQueries({ queryKey: ['agent-model', variables.agentName] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentCreatePayload) => api.createAgent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['agent-models'] });
    },
  });
}
