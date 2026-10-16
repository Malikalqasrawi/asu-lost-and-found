import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/api/client';

export interface HealthStatus {
  status: 'ok';
  database: 'up';
}

export function useServerHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthStatus>('/health'),
    retry: false,
  });
}
