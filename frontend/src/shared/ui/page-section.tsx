import type { ReactNode } from 'react';
import { Paper, Stack, Typography } from '@mui/material';

interface PageSectionProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageSection({ title, subtitle, actions, children }: PageSectionProps) {
  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      {(title || subtitle || actions) && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1.5}
          mb={2}
        >
          <Stack spacing={0.75}>
            {title && <Typography variant="sectionTitle">{title}</Typography>}
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Stack>
          {actions}
        </Stack>
      )}
      {children}
    </Paper>
  );
}
