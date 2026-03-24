import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getEventSource } from '../api/client';

export function useEventStream() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = getEventSource();

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      queryClient.invalidateQueries({ queryKey: ['agent-status'] });
    };

    const handlers = ['task.created', 'task.updated', 'task.log', 'config.updated', 'permission.updated'];
    handlers.forEach((event) => {
      source.addEventListener(event, refresh);
    });

    source.onerror = () => {
      source.close();
    };

    return () => {
      handlers.forEach((event) => {
        source.removeEventListener(event, refresh);
      });
      source.close();
    };
  }, [queryClient]);
}
