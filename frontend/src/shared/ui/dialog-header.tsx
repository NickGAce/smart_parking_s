import type { ReactNode } from 'react';
import { DialogTitle, Stack, Typography } from '@mui/material';

interface DialogHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  titleId?: string;
  subtitleId?: string;
}

export function DialogHeader({ title, subtitle, titleId, subtitleId }: DialogHeaderProps) {
  return (
    <DialogTitle id={titleId} sx={{ pb: subtitle ? 1 : 2 }}>
      <Stack spacing={0.5}>
        <Typography component="span" variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography id={subtitleId} component="span" variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
    </DialogTitle>
  );
}
