import type { ReactNode } from 'react';
import { Chip, Stack, Typography, type ChipProps, type SxProps, type Theme } from '@mui/material';

import { ContentCard } from './content-card';

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  helperText?: ReactNode;
  secondaryValue?: ReactNode;
  badgeLabel?: ReactNode;
  badgeColor?: ChipProps['color'];
  sx?: SxProps<Theme>;
}

export function MetricCard({
  label,
  value,
  helperText,
  secondaryValue,
  badgeLabel,
  badgeColor = 'default',
  sx,
}: MetricCardProps) {
  return (
    <ContentCard
      sx={{
        p: 2,
        borderRadius: (theme) => theme.foundation.radius.xs,
        height: '100%',
        ...sx,
      }}
    >
      <Stack spacing={1} minWidth={0} height="100%" justifyContent="space-between">
        <Stack spacing={0.75} minWidth={0}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
              {label}
            </Typography>
            {badgeLabel ? <Chip size="small" label={badgeLabel} color={badgeColor} variant="outlined" /> : null}
          </Stack>
          <Typography variant="h4" sx={{ lineHeight: 1.05, wordBreak: 'break-word' }}>
            {value}
          </Typography>
          {secondaryValue ? (
            <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
              {secondaryValue}
            </Typography>
          ) : null}
        </Stack>
        {helperText ? (
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
            {helperText}
          </Typography>
        ) : null}
      </Stack>
    </ContentCard>
  );
}
