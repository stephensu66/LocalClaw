import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskCreateInput } from '@openclaw/shared';
import { api } from '../api/client';

type TaskCreateWithAgentInput = TaskCreateInput & { agentName?: string | null };

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(),
  });
}

export function useTask(taskId?: string) {
  return useQuery({
    queryKey: ['tasks', taskId],
    queryFn: () => api.getTask(taskId ?? ''),
    enabled: Boolean(taskId),
  });
}

export function useTaskLogs(taskId?: string) {
  return useQuery({
    queryKey: ['task-logs', taskId],
    queryFn: () => api.getTaskLogs(taskId ?? ''),
    enabled: Boolean(taskId),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCreateWithAgentInput) => api.createTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
