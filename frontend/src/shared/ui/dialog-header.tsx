import type { ReactNode } from 'react';
import { DialogTitle, Stack, Typography } from '@mui/material';

interface DialogHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
}

export function DialogHeader({ title, subtitle }: DialogHeaderProps) {
  return (
    <DialogTitle sx={{ pb: subtitle ? 1 : 2 }}>
      <Stack spacing={0.5}>
        <Typography component="span" variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography component="span" variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
    </DialogTitle>
  );
}
