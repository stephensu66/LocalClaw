import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.listPermissions(),
  });
}

export function useUpdatePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, granted }: { key: string; granted: boolean }) =>
      api.updatePermission(key, { granted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}
