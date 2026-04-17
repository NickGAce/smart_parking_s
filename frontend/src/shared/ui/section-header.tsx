import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}

export function SectionHeader({ title, subtitle, eyebrow, actions, compact = false }: SectionHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: compact ? 'flex-start' : 'center' }}
      gap={compact ? 1 : 1.5}
      mb={compact ? 1.5 : 2}
    >
      <Stack spacing={0.75} minWidth={0}>
        {eyebrow && (
          <Typography variant="tableLabel" color="text.secondary">
            {eyebrow}
          </Typography>
        )}
        <Typography variant="sectionTitle" sx={{ wordBreak: 'break-word' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 820, wordBreak: 'break-word' }}>
            {subtitle}
          </Typography>
        )}
      </Stack>
      {actions}
    </Stack>
  );
}
