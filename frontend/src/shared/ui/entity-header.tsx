import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

import { ToolbarActions } from './toolbar-actions';

interface EntityHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function EntityHeader({ title, subtitle, meta, actions }: EntityHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
      gap={1.5}
    >
      <Stack spacing={0.5} minWidth={0}>
        {meta ? (
          <Typography variant="tableLabel" color="text.secondary">
            {meta}
          </Typography>
        ) : null}
        <Typography variant="pageTitle" sx={{ wordBreak: 'break-word' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 900, wordBreak: 'break-word' }}>
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      {actions ? <ToolbarActions>{actions}</ToolbarActions> : null}
    </Stack>
  );
}
