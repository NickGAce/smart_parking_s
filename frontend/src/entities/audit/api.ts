import { httpClient } from '../../shared/api/http-client';
import type { AuditLogListResponse, AuditLogsQuery } from '../../shared/types/audit';

export const auditApi = {
  getAuditLogs: async (params?: AuditLogsQuery): Promise<AuditLogListResponse> => {
    const { data } = await httpClient.get<AuditLogListResponse>('/audit-logs', { params });
    return data;
  },
};
