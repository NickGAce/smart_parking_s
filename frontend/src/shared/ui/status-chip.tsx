import { Chip } from '@mui/material';

import type { StatusMeta } from '../config/status-map';

export function StatusChip({ status, mapping }: { status: string; mapping: Record<string, StatusMeta> }) {
  const meta = mapping[status] ?? { label: status, color: 'default' as const };

  return <Chip size="small" label={meta.label} color={meta.color} />;
}
