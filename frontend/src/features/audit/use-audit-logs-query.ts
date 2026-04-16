import { useQuery } from '@tanstack/react-query';

import { auditApi } from '../../entities/audit/api';
import type { AuditLogsQuery } from '../../shared/types/audit';

const auditQueryKeys = {
  all: ['audit-logs'] as const,
  list: (params?: AuditLogsQuery) => [...auditQueryKeys.all, 'list', params ?? {}] as const,
};

export function useAuditLogsQuery(params?: AuditLogsQuery) {
  return useQuery({
    queryKey: auditQueryKeys.list(params),
    queryFn: () => auditApi.getAuditLogs(params),
    staleTime: 30_000,
  });
}
