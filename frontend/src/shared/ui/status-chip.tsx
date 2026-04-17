import { Chip } from '@mui/material';

import type { StatusMeta } from '../config/status-map';

interface StatusChipProps {
  status: string;
  mapping: Record<string, StatusMeta>;
  variant?: 'filled' | 'outlined';
}

export function StatusChip({ status, mapping, variant = 'filled' }: StatusChipProps) {
  const meta = mapping[status] ?? { label: status, color: 'default' as const };

  return <Chip size="small" label={meta.label} color={meta.color} variant={variant} sx={{ fontWeight: 600 }} />;
}
