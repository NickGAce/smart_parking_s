import type { ListResponse } from './common';

export interface AuditLog {
  id: number;
  actor_user_id: number | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  source_metadata: Record<string, unknown> | null;
  timestamp: string;
}

export interface AuditLogsQuery {
  actor_user_id?: number;
  action_type?: string;
  entity_type?: string;
  entity_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export type AuditLogListResponse = ListResponse<AuditLog>;
