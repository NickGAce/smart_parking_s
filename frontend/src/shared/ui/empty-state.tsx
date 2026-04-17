import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ title, description, icon, actions, compact = false }: EmptyStateProps) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1}
      py={compact ? 3 : 6}
      textAlign="center"
      sx={{
        color: 'text.secondary',
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'surface.overlay',
          color: 'text.secondary',
        }}
      >
        {icon ?? <InboxOutlinedIcon fontSize="small" />}
      </Box>
      <Typography variant="h6" color="text.primary" sx={{ wordBreak: 'break-word' }}>
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ maxWidth: 560, wordBreak: 'break-word' }}>
          {description}
        </Typography>
      )}
      {actions}
    </Stack>
  );
}

export function EmptyStateIllustrated(props: EmptyStateProps) {
  return <EmptyState {...props} />;
}
